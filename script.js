class WebRTCVideoChat {
    constructor() {
        this.localVideo = document.getElementById('localVideo');
        this.remoteVideo = document.getElementById('remoteVideo');
        this.roomIdInput = document.getElementById('roomId');
        this.createRoomBtn = document.getElementById('createRoom');
        this.joinRoomBtn = document.getElementById('joinRoom');
        this.leaveRoomBtn = document.getElementById('leaveRoom');
        this.toggleVideoBtn = document.getElementById('toggleVideo');
        this.toggleAudioBtn = document.getElementById('toggleAudio');
        this.shareScreenBtn = document.getElementById('shareScreen');
        this.connectionStatus = document.getElementById('connectionStatus');
        this.currentRoom = document.getElementById('currentRoom');
        this.chatMessages = document.getElementById('chatMessages');
        this.messageInput = document.getElementById('messageInput');
        this.sendMessageBtn = document.getElementById('sendMessage');

        this.localStream = null;
        this.remoteStream = null;
        this.peerConnection = null;
        this.dataChannel = null;
        this.currentRoomId = null;
        this.isVideoEnabled = true;
        this.isAudioEnabled = true;
        this.isScreenSharing = false;
        this.isHost = false; // 是否为房间创建者
        
        // 简单的加密密钥（生产环境应该使用更安全的方法）
        this.secretKey = 'WebRTC-VideoChat-2025';

        // STUN servers for NAT traversal
        this.servers = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' }
            ]
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.updateConnectionStatus('未连接');
    }

    setupEventListeners() {
        this.createRoomBtn.addEventListener('click', () => this.createRoom());
        this.joinRoomBtn.addEventListener('click', () => this.joinRoom());
        this.leaveRoomBtn.addEventListener('click', () => this.leaveRoom());
        this.toggleVideoBtn.addEventListener('click', () => this.toggleVideo());
        this.toggleAudioBtn.addEventListener('click', () => this.toggleAudio());
        this.shareScreenBtn.addEventListener('click', () => this.toggleScreenShare());
        this.sendMessageBtn.addEventListener('click', () => this.sendMessage());
        
        this.messageInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    async createRoom() {
        try {
            await this.startLocalStream();
            await this.setupPeerConnection();
            
            // 创建offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            // 将offer加密生成token密码
            const token = this.encryptOffer(offer);
            
            this.roomIdInput.value = token;
            this.currentRoomId = token;
            this.isHost = true;
            
            this.updateConnectionStatus('等待对方加入');
            this.currentRoom.textContent = `房间: ${token.substring(0, 8)}...`;
            this.toggleRoomButtons(true);
            
            this.addChatMessage('系统', `🎉 房间创建成功！`);
            this.addChatMessage('系统', `� 房间密码: ${token}`);
            this.addChatMessage('系统', `💡 请将此密码分享给其他人，他们输入密码即可加入！`);
            
            console.log(`✅ 房间已创建，密码: ${token}`);
            
        } catch (error) {
            console.error('创建房间失败:', error);
            this.addChatMessage('系统', '❌ 创建房间失败: ' + error.message);
        }
    }

    async joinRoom() {
        try {
            const token = this.roomIdInput.value.trim();
            if (!token) {
                alert('请输入房间密码');
                return;
            }

            // 尝试解密token获取offer信息
            const offer = this.decryptToken(token);
            if (!offer) {
                alert('❌ 房间密码无效！请检查密码是否正确。');
                return;
            }

            this.isHost = false;
            await this.startLocalStream();
            await this.setupPeerConnection();
            
            this.currentRoomId = token;
            this.updateConnectionStatus('正在连接');
            this.currentRoom.textContent = `房间: ${token.substring(0, 8)}...`;
            this.toggleRoomButtons(true);
            
            this.addChatMessage('系统', `🔐 正在加入房间...`);
            
            // 设置远程offer并创建answer
            await this.peerConnection.setRemoteDescription(offer);
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.addChatMessage('系统', '🤝 正在建立连接...');
            this.addChatMessage('系统', '💡 等待房间创建者接受连接...');
            
            // 生成加密的answer token
            const answerToken = this.encryptAnswer(answer);
            this.addChatMessage('系统', `📋 Answer密码: ${answerToken}`);
            this.addChatMessage('系统', `💡 请将此Answer密码发送给房间创建者`);
            this.addChatMessage('系统', `📝 创建者运行: window.videoChat.acceptAnswer("${answerToken}")`);
            
            console.log('📋 Answer密码:', answerToken);
            console.log('💡 房间创建者请运行:', `window.videoChat.acceptAnswer("${answerToken}")`);
            
        } catch (error) {
            console.error('加入房间失败:', error);
            this.addChatMessage('系统', '❌ 加入房间失败: ' + error.message);
        }
    }

    async leaveRoom() {
        if (this.peerConnection) {
            this.peerConnection.close();
            this.peerConnection = null;
        }

        if (this.localStream) {
            this.localStream.getTracks().forEach(track => track.stop());
            this.localStream = null;
        }

        this.localVideo.srcObject = null;
        this.remoteVideo.srcObject = null;
        this.currentRoomId = null;
        this.isHost = false;
        this.updateConnectionStatus('未连接');
        this.currentRoom.textContent = '';
        this.toggleRoomButtons(false);
        this.addChatMessage('系统', '👋 已离开房间');
    }

    async startLocalStream() {
        try {
            const constraints = {
                video: true,
                audio: true
            };
            this.localStream = await navigator.mediaDevices.getUserMedia(constraints);
            this.localVideo.srcObject = this.localStream;
            
        } catch (error) {
            console.error('获取本地媒体流失败:', error);
            throw new Error('无法访问摄像头和麦克风');
        }
    }

    async setupPeerConnection() {
        this.peerConnection = new RTCPeerConnection(this.servers);

        // Add local stream tracks to peer connection
        if (this.localStream) {
            this.localStream.getTracks().forEach(track => {
                this.peerConnection.addTrack(track, this.localStream);
            });
        }

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('📺 接收到远程视频流');
            this.remoteVideo.srcObject = event.streams[0];
            this.updateConnectionStatus('✅ 已连接');
            this.addChatMessage('系统', '🎥 视频通话已建立');
        };

        // Handle ICE candidates (简化处理)
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🔄 ICE候选:', event.candidate.candidate);
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            const state = this.peerConnection.connectionState;
            console.log('🔗 连接状态:', state);
            
            switch (state) {
                case 'connected':
                    this.updateConnectionStatus('✅ 已连接');
                    break;
                case 'connecting':
                    this.updateConnectionStatus('🔄 连接中');
                    break;
                case 'disconnected':
                    this.updateConnectionStatus('⚠️ 连接断开');
                    break;
                case 'failed':
                    this.updateConnectionStatus('❌ 连接失败');
                    break;
            }
        };

        // Setup data channel for chat
        this.setupDataChannel();
    }

    setupDataChannel() {
        // Create data channel for chat
        this.dataChannel = this.peerConnection.createDataChannel('chat', {
            ordered: true
        });

        this.dataChannel.onopen = () => {
            console.log('💬 聊天通道已开启');
        };

        this.dataChannel.onmessage = (event) => {
            const message = JSON.parse(event.data);
            this.addChatMessage(message.sender, message.text, false);
        };

        // Handle incoming data channel
        this.peerConnection.ondatachannel = (event) => {
            const channel = event.channel;
            channel.onmessage = (event) => {
                const message = JSON.parse(event.data);
                this.addChatMessage(message.sender, message.text, false);
            };
        };
    }

    async toggleVideo() {
        if (this.localStream) {
            const videoTrack = this.localStream.getVideoTracks()[0];
            if (videoTrack) {
                videoTrack.enabled = !videoTrack.enabled;
                this.isVideoEnabled = videoTrack.enabled;
                this.toggleVideoBtn.textContent = this.isVideoEnabled ? '📷 关闭摄像头' : '📷 开启摄像头';
                this.addChatMessage('系统', this.isVideoEnabled ? '📷 摄像头已开启' : '📷 摄像头已关闭');
            }
        }
    }

    async toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isAudioEnabled = audioTrack.enabled;
                this.toggleAudioBtn.textContent = this.isAudioEnabled ? '🔇 静音' : '🔊 取消静音';
                this.addChatMessage('系统', this.isAudioEnabled ? '🔊 麦克风已开启' : '🔇 麦克风已静音');
            }
        }
    }

    async toggleScreenShare() {
        try {
            if (!this.isScreenSharing) {
                // Start screen sharing
                const screenStream = await navigator.mediaDevices.getDisplayMedia({
                    video: true,
                    audio: true
                });

                // Replace video track
                const videoTrack = screenStream.getVideoTracks()[0];
                const sender = this.peerConnection.getSenders().find(s => 
                    s.track && s.track.kind === 'video'
                );

                if (sender) {
                    await sender.replaceTrack(videoTrack);
                }

                this.localVideo.srcObject = screenStream;
                this.shareScreenBtn.textContent = '📺 停止分享';
                this.isScreenSharing = true;
                this.addChatMessage('系统', '📺 开始分享屏幕');

                // Handle screen share end
                videoTrack.onended = () => {
                    this.stopScreenShare();
                };

            } else {
                this.stopScreenShare();
            }
        } catch (error) {
            console.error('屏幕分享失败:', error);
            this.addChatMessage('系统', '屏幕分享失败: ' + error.message);
        }
    }

    async stopScreenShare() {
        try {
            // Restart camera
            const cameraStream = await navigator.mediaDevices.getUserMedia({
                video: true,
                audio: true
            });

            const videoTrack = cameraStream.getVideoTracks()[0];
            const sender = this.peerConnection.getSenders().find(s => 
                s.track && s.track.kind === 'video'
            );

            if (sender) {
                await sender.replaceTrack(videoTrack);
            }

            this.localVideo.srcObject = cameraStream;
            this.localStream = cameraStream;
            this.shareScreenBtn.textContent = '📺 分享屏幕';
            this.isScreenSharing = false;
            this.addChatMessage('系统', '📷 已切换回摄像头');

        } catch (error) {
            console.error('停止屏幕分享失败:', error);
        }
    }

    sendMessage() {
        const message = this.messageInput.value.trim();
        if (message && this.dataChannel && this.dataChannel.readyState === 'open') {
            const messageData = {
                sender: '我',
                text: message,
                timestamp: new Date().toLocaleTimeString()
            };

            this.dataChannel.send(JSON.stringify(messageData));
            this.addChatMessage('我', message, true);
            this.messageInput.value = '';
        } else if (message) {
            this.addChatMessage('我', message, true);
            this.messageInput.value = '';
            this.addChatMessage('系统', '⚠️ 聊天功能需要建立连接后使用');
        }
    }

    addChatMessage(sender, text, isLocal = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isLocal ? 'local' : 'remote'}`;
        
        const timestamp = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <div class="message-text">${text}</div>
            <div class="timestamp">${sender} - ${timestamp}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateConnectionStatus(status) {
        this.connectionStatus.textContent = status;
        
        // 更新状态样式
        if (status.includes('已连接') || status.includes('✅')) {
            this.connectionStatus.className = 'connected';
        } else if (status.includes('连接') || status.includes('🔄')) {
            this.connectionStatus.className = 'connecting';
        } else {
            this.connectionStatus.className = 'disconnected';
        }
    }

    toggleRoomButtons(inRoom) {
        this.createRoomBtn.disabled = inRoom;
        this.joinRoomBtn.disabled = inRoom;
        this.leaveRoomBtn.disabled = !inRoom;
        this.roomIdInput.disabled = inRoom;
    }

    generateRoomPassword() {
        // 生成简单易记的6位房间密码
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let password = '';
        for (let i = 0; i < 6; i++) {
            password += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return password;
    }

    // 浏览器兼容的加密函数
    encryptOffer(offer) {
        try {
            const data = JSON.stringify(offer);
            // 使用简单的 Base64 + 时间戳编码
            const timestamp = Date.now().toString();
            const encoded = btoa(unescape(encodeURIComponent(data + '|' + timestamp)));
            // 添加一个简单的校验码
            const checksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
            return `ROOM_${checksum}_${encoded}`;
        } catch (error) {
            console.error('加密失败:', error);
            // 如果加密失败，使用简单的Base64编码
            return `SIMPLE_${btoa(JSON.stringify(offer))}`;
        }
    }

    // 解密token获取offer
    decryptToken(token) {
        try {
            if (token.startsWith('ROOM_')) {
                // 新格式：ROOM_checksum_encoded
                const parts = token.split('_');
                if (parts.length !== 3) return null;
                
                const checksum = parts[1];
                const encoded = parts[2];
                
                // 验证校验码
                const expectedChecksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
                if (checksum !== expectedChecksum) {
                    console.error('校验码验证失败');
                    return null;
                }
                
                const decoded = decodeURIComponent(escape(atob(encoded)));
                const [offerData, timestamp] = decoded.split('|');
                
                return JSON.parse(offerData);
            } else if (token.startsWith('SIMPLE_')) {
                // 兼容简单格式
                const encoded = token.substring(7);
                return JSON.parse(atob(encoded));
            }
            
            return null;
        } catch (error) {
            console.error('解密失败:', error);
            return null;
        }
    }

    // 显示answer给房间创建者
    showAnswerForHost(answer) {
        const answerToken = this.encryptAnswer(answer);
        console.log('📋 请将以下Answer密码发送给房间创建者：');
        console.log(`Answer密码: ${answerToken}`);
        
        this.addChatMessage('系统', `📋 Answer密码: ${answerToken}`);
        this.addChatMessage('系统', '💡 请将此Answer密码发送给房间创建者');
        this.addChatMessage('系统', `📝 创建者运行: window.videoChat.acceptAnswer("${answerToken}")`);
    }

    // 加密answer生成token
    encryptAnswer(answer) {
        try {
            const data = JSON.stringify(answer);
            const timestamp = Date.now().toString();
            const encoded = btoa(unescape(encodeURIComponent(data + '|' + timestamp)));
            const checksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
            return `ANS_${checksum}_${encoded}`;
        } catch (error) {
            console.error('Answer加密失败:', error);
            return `SIMPLE_ANS_${btoa(JSON.stringify(answer))}`;
        }
    }

    // 解密answer token
    decryptAnswerToken(token) {
        try {
            if (token.startsWith('ANS_')) {
                const parts = token.split('_');
                if (parts.length !== 3) return null;
                
                const checksum = parts[1];
                const encoded = parts[2];
                
                const expectedChecksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
                if (checksum !== expectedChecksum) {
                    console.error('Answer校验码验证失败');
                    return null;
                }
                
                const decoded = decodeURIComponent(escape(atob(encoded)));
                const [answerData, timestamp] = decoded.split('|');
                
                return JSON.parse(answerData);
            } else if (token.startsWith('SIMPLE_ANS_')) {
                const encoded = token.substring(11);
                return JSON.parse(atob(encoded));
            }
            
            return null;
        } catch (error) {
            console.error('Answer解密失败:', error);
            return null;
        }
    }

    // 简单的哈希函数（浏览器兼容）
    simpleHash(str) {
        let hash = 0;
        if (str.length === 0) return hash.toString();
        
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash; // 转换为32位整数
        }
        
        return Math.abs(hash).toString(16);
    }

    // 房间创建者接受answer连接
    async acceptAnswer(answerToken) {
        try {
            const answer = this.decryptAnswerToken(answerToken);
            if (!answer) {
                this.addChatMessage('系统', '❌ 无效的Answer密码！');
                return;
            }

            await this.peerConnection.setRemoteDescription(answer);
            this.addChatMessage('系统', '✅ 连接建立成功！');
            
        } catch (error) {
            console.error('接受Answer失败:', error);
            this.addChatMessage('系统', '❌ 连接失败: ' + error.message);
        }
    }
}

// Initialize the video chat application
document.addEventListener('DOMContentLoaded', () => {
    window.videoChat = new WebRTCVideoChat();
    console.log('🎥 WebRTC视频聊天应用已初始化');
    console.log('💡 使用说明：');
    console.log('1. 创建者：点击"创建房间"生成加密密码');
    console.log('2. 加入者：输入密码点击"加入房间"');
    console.log('3. 加入者会看到Answer密码，发送给创建者');
    console.log('4. 创建者运行: window.videoChat.acceptAnswer("Answer密码")');
});

// 全局方法：房间创建者接受连接
window.acceptAnswer = (answerToken) => {
    if (window.videoChat && window.videoChat.isHost) {
        window.videoChat.acceptAnswer(answerToken);
    } else {
        console.error('❌ 只有房间创建者可以接受Answer，或者应用尚未初始化');
    }
};
