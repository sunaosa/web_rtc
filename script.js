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
        this.iceCandidates = []; // 存储ICE候选
        
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
            
            // 初始化ICE候选收集
            this.iceCandidates = [];
            
            // 创建offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            console.log('🔍 创建的offer:', offer);
            console.log('🔍 Offer类型:', typeof offer);
            console.log('🔍 Offer内容:', JSON.stringify(offer, null, 2));
            
            this.updateConnectionStatus('等待对方加入');
            this.addChatMessage('系统', '🎉 房间创建中...');
            
            // 等待ICE候选收集完成，然后生成token
            setTimeout(() => {
                const roomData = {
                    offer: offer,
                    iceCandidates: this.iceCandidates || []
                };
                
                const token = this.encryptOffer(roomData);
                
                this.roomIdInput.value = token;
                this.currentRoomId = token;
                this.isHost = true;
                this.currentRoom.textContent = `房间: ${token.substring(0, 8)}...`;
                this.toggleRoomButtons(true);
                
                this.addChatMessage('系统', `🎉 房间创建成功！`);
                this.addChatMessage('系统', `🔑 房间密码: ${token}`);
                this.addChatMessage('系统', `💡 请将此密码分享给其他人，他们输入密码即可加入！`);
                this.addChatMessage('系统', `🔄 已收集 ${this.iceCandidates.length} 个ICE候选`);
                
                console.log(`✅ 房间已创建，密码: ${token}`);
                console.log(`🔄 收集到 ${this.iceCandidates.length} 个ICE候选`);
            }, 3000); // 等待3秒收集ICE候选
            
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

            // 尝试解密token获取offer和ICE候选信息
            const roomData = this.decryptToken(token);
            if (!roomData || !roomData.offer) {
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
            
            // 设置远程offer
            console.log('🔍 准备设置远程offer:', roomData.offer);
            console.log('🔍 Offer类型:', typeof roomData.offer);
            console.log('🔍 Offer内容:', JSON.stringify(roomData.offer, null, 2));
            
            // 验证offer格式
            if (!roomData.offer || !roomData.offer.type || !roomData.offer.sdp) {
                throw new Error('无效的offer格式：缺少type或sdp字段');
            }
            
            await this.peerConnection.setRemoteDescription(roomData.offer);
            
            // 添加主机的ICE候选
            if (roomData.iceCandidates && roomData.iceCandidates.length > 0) {
                console.log(`🔄 处理 ${roomData.iceCandidates.length} 个ICE候选`);
                for (const candidate of roomData.iceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('✅ ICE候选添加成功');
                    } catch (error) {
                        console.error('❌ ICE候选添加失败:', error);
                    }
                }
            }
            
            // 初始化自己的ICE候选收集
            this.iceCandidates = [];
            
            // 创建answer
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            this.addChatMessage('系统', '🤝 正在建立连接...');
            
            // 等待ICE候选收集完成
            setTimeout(async () => {
                // 生成包含ICE候选的answer token
                const answerData = {
                    answer: answer,
                    iceCandidates: this.iceCandidates || []
                };
                
                const answerToken = this.encryptAnswer(answerData);
                this.addChatMessage('系统', `📋 Answer密码: ${answerToken}`);
                this.addChatMessage('系统', `💡 请将此Answer密码发送给房间创建者`);
                this.addChatMessage('系统', `📝 创建者运行: window.videoChat.acceptAnswer("${answerToken}")`);
                this.addChatMessage('系统', `🔄 已收集 ${this.iceCandidates.length} 个ICE候选`);
                
                console.log('📋 Answer密码:', answerToken);
                console.log('💡 房间创建者请运行:', `window.videoChat.acceptAnswer("${answerToken}")`);
                console.log(`🔄 收集到 ${this.iceCandidates.length} 个ICE候选`);
            }, 3000); // 等待3秒收集ICE候选
            
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
            
            // 确保本地视频能够播放
            this.localVideo.autoplay = true;
            this.localVideo.playsInline = true;
            this.localVideo.muted = true;
            
            console.log('✅ 本地媒体流获取成功');
            console.log('📺 视频轨道:', this.localStream.getVideoTracks().length);
            console.log('🔊 音频轨道:', this.localStream.getAudioTracks().length);
            
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
                console.log(`📤 添加本地轨道: ${track.kind}`);
                this.peerConnection.addTrack(track, this.localStream);
            });
            console.log('✅ 所有本地轨道已添加到PeerConnection');
        }

        // Handle remote stream
        this.peerConnection.ontrack = (event) => {
            console.log('📺 接收到远程视频流', event);
            console.log('📺 Streams:', event.streams);
            console.log('📺 Track:', event.track);
            
            if (event.streams && event.streams.length > 0) {
                this.remoteVideo.srcObject = event.streams[0];
                console.log('✅ 远程视频流设置成功');
                
                // 检查流的状态
                const stream = event.streams[0];
                console.log('📊 远程流信息:');
                console.log('  - 视频轨道数量:', stream.getVideoTracks().length);
                console.log('  - 音频轨道数量:', stream.getAudioTracks().length);
                console.log('  - 流ID:', stream.id);
                console.log('  - 流活跃状态:', stream.active);
                
            } else if (event.track) {
                // 如果没有streams，手动创建MediaStream
                if (!this.remoteStream) {
                    this.remoteStream = new MediaStream();
                    this.remoteVideo.srcObject = this.remoteStream;
                }
                this.remoteStream.addTrack(event.track);
                console.log('✅ 远程track添加成功');
                console.log('📊 轨道信息:', event.track.kind, event.track.id);
            }
            
            // 确保远程视频能够播放
            this.remoteVideo.autoplay = true;
            this.remoteVideo.playsInline = true;
            
            // 尝试播放远程视频
            this.remoteVideo.play().catch(err => {
                console.log('远程视频自动播放失败，用户需要手动点击播放:', err);
                this.addChatMessage('系统', '🎥 远程视频已就绪，如无法自动播放请手动点击播放按钮');
            });
            
            // 监听视频元素的事件
            this.remoteVideo.addEventListener('loadedmetadata', () => {
                console.log('✅ 远程视频元数据加载完成');
                console.log(`📐 视频尺寸: ${this.remoteVideo.videoWidth} x ${this.remoteVideo.videoHeight}`);
            });
            
            this.remoteVideo.addEventListener('loadeddata', () => {
                console.log('✅ 远程视频数据加载完成');
            });
            
            this.remoteVideo.addEventListener('playing', () => {
                console.log('✅ 远程视频开始播放');
            });
            
            this.updateConnectionStatus('✅ 已连接');
            this.addChatMessage('系统', '🎥 视频通话已建立');
        };

        // Handle ICE candidates - 收集并存储ICE候选
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('🔄 收集到ICE候选:', event.candidate.candidate);
                // 存储ICE候选
                if (!this.iceCandidates) {
                    this.iceCandidates = [];
                }
                this.iceCandidates.push(event.candidate);
            } else {
                console.log('🔄 ICE候选收集完成');
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
    encryptOffer(roomData) {
        try {
            console.log('🔐 加密房间数据:', roomData);
            
            // 确保数据格式正确
            const data = {
                offer: roomData.offer || roomData,
                iceCandidates: roomData.iceCandidates || this.iceCandidates || [],
                timestamp: Date.now()
            };
            
            console.log('🔐 最终加密数据:', data);
            
            const jsonString = JSON.stringify(data);
            const encoded = btoa(unescape(encodeURIComponent(jsonString + '|' + data.timestamp)));
            const checksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
            return `ROOM_${checksum}_${encoded}`;
        } catch (error) {
            console.error('加密失败:', error);
            return `SIMPLE_${btoa(JSON.stringify(roomData))}`;
        }
    }

    // 解密token获取offer
    decryptToken(token) {
        try {
            if (token.startsWith('ROOM_')) {
                const parts = token.split('_');
                if (parts.length !== 3) return null;
                
                const checksum = parts[1];
                const encoded = parts[2];
                
                const expectedChecksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
                if (checksum !== expectedChecksum) {
                    console.error('校验码验证失败');
                    return null;
                }
                
                const decoded = decodeURIComponent(escape(atob(encoded)));
                // 处理包含时间戳的格式
                const [dataString, timestamp] = decoded.split('|');
                const data = JSON.parse(dataString || decoded);
                
                console.log('🔍 解密数据:', data);
                
                // 新格式包含ICE候选
                if (data.offer && typeof data.offer === 'object') {
                    return {
                        offer: data.offer,
                        iceCandidates: data.iceCandidates || []
                    };
                }
                
                // 兼容旧格式 - 直接是offer对象
                if (data.type && data.sdp) {
                    return { 
                        offer: data, 
                        iceCandidates: [] 
                    };
                }
                
                return null;
                
            } else if (token.startsWith('SIMPLE_')) {
                const encoded = token.substring(7);
                const offer = JSON.parse(atob(encoded));
                return { offer: offer, iceCandidates: [] };
            }
            
            return null;
        } catch (error) {
            console.error('解密失败:', error);
            console.error('Token:', token);
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
    encryptAnswer(answerData) {
        try {
            console.log('🔐 加密Answer数据:', answerData);
            
            // 确保数据格式正确
            const data = {
                answer: answerData.answer || answerData,
                iceCandidates: answerData.iceCandidates || this.iceCandidates || [],
                timestamp: Date.now()
            };
            
            console.log('🔐 最终加密Answer数据:', data);
            
            const jsonString = JSON.stringify(data);
            const encoded = btoa(unescape(encodeURIComponent(jsonString + '|' + data.timestamp)));
            const checksum = this.simpleHash(encoded + this.secretKey).substring(0, 8);
            return `ANS_${checksum}_${encoded}`;
        } catch (error) {
            console.error('Answer加密失败:', error);
            return `SIMPLE_ANS_${btoa(JSON.stringify(answerData))}`;
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
                // 处理包含时间戳的格式
                const [dataString, timestamp] = decoded.split('|');
                const data = JSON.parse(dataString || decoded);
                
                console.log('🔍 解密Answer数据:', data);
                
                // 新格式包含ICE候选
                if (data.answer && typeof data.answer === 'object') {
                    return {
                        answer: data.answer,
                        iceCandidates: data.iceCandidates || []
                    };
                }
                
                // 兼容旧格式 - 直接是answer对象
                if (data.type && data.sdp) {
                    return { 
                        answer: data, 
                        iceCandidates: [] 
                    };
                }
                
                return null;
                
            } else if (token.startsWith('SIMPLE_ANS_')) {
                const encoded = token.substring(11);
                const answer = JSON.parse(atob(encoded));
                return { answer: answer, iceCandidates: [] };
            }
            
            return null;
        } catch (error) {
            console.error('Answer解密失败:', error);
            console.error('Token:', token);
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
            const answerData = this.decryptAnswerToken(answerToken);
            if (!answerData || !answerData.answer) {
                this.addChatMessage('系统', '❌ 无效的Answer密码！');
                return;
            }

            // 设置远程answer
            await this.peerConnection.setRemoteDescription(answerData.answer);
            
            // 添加加入者的ICE候选
            if (answerData.iceCandidates && answerData.iceCandidates.length > 0) {
                console.log(`🔄 处理 ${answerData.iceCandidates.length} 个ICE候选`);
                for (const candidate of answerData.iceCandidates) {
                    try {
                        await this.peerConnection.addIceCandidate(candidate);
                        console.log('✅ ICE候选添加成功');
                    } catch (error) {
                        console.error('❌ ICE候选添加失败:', error);
                    }
                }
            }
            
            this.addChatMessage('系统', '✅ 连接建立成功！');
            console.log('✅ 连接已建立');
            
        } catch (error) {
            console.error('接受Answer失败:', error);
            this.addChatMessage('系统', '❌ 连接失败: ' + error.message);
        }
    }

    // 更新token中的ICE候选信息
    updateTokenWithIce() {
        if (this.isHost && this.iceCandidates.length > 0) {
            console.log(`🔄 收集到 ${this.iceCandidates.length} 个ICE候选`);
            // 主机的ICE候选会在创建房间时自动包含在offer中
        }
    }

    // 处理ICE候选
    async handleIceCandidates(candidates) {
        if (candidates && Array.isArray(candidates)) {
            for (const candidate of candidates) {
                try {
                    await this.peerConnection.addIceCandidate(candidate);
                    console.log('✅ 添加ICE候选成功');
                } catch (error) {
                    console.error('❌ 添加ICE候选失败:', error);
                }
            }
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
