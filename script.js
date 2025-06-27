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
            const roomId = this.generateRoomId();
            this.roomIdInput.value = roomId;
            await this.startLocalStream();
            await this.setupPeerConnection();
            this.currentRoomId = roomId;
            this.updateConnectionStatus('等待对方加入');
            this.currentRoom.textContent = `房间: ${roomId}`;
            this.toggleRoomButtons(true);
            
            // Create offer
            const offer = await this.peerConnection.createOffer();
            await this.peerConnection.setLocalDescription(offer);
            
            this.addChatMessage('系统', `房间 ${roomId} 已创建，等待其他人加入...`);
            
            // In a real application, you would send this offer to a signaling server
            console.log('Offer created:', offer);
            this.showOfferInstructions(offer);
            
        } catch (error) {
            console.error('创建房间失败:', error);
            this.addChatMessage('系统', '创建房间失败: ' + error.message);
        }
    }

    async joinRoom() {
        try {
            const roomId = this.roomIdInput.value.trim();
            if (!roomId) {
                alert('请输入房间ID');
                return;
            }

            await this.startLocalStream();
            await this.setupPeerConnection();
            this.currentRoomId = roomId;
            this.updateConnectionStatus('正在连接');
            this.currentRoom.textContent = `房间: ${roomId}`;
            this.toggleRoomButtons(true);
            
            this.addChatMessage('系统', `正在加入房间 ${roomId}...`);
            
            // In a real application, you would get the offer from a signaling server
            this.showJoinInstructions();
            
        } catch (error) {
            console.error('加入房间失败:', error);
            this.addChatMessage('系统', '加入房间失败: ' + error.message);
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
        this.updateConnectionStatus('未连接');
        this.currentRoom.textContent = '';
        this.toggleRoomButtons(false);
        this.addChatMessage('系统', '已离开房间');
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
            console.log('Received remote stream');
            this.remoteVideo.srcObject = event.streams[0];
            this.updateConnectionStatus('已连接');
        };

        // Handle ICE candidates
        this.peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('ICE candidate:', event.candidate);
                // In a real application, you would send this candidate to the other peer
            }
        };

        // Handle connection state changes
        this.peerConnection.onconnectionstatechange = () => {
            console.log('Connection state:', this.peerConnection.connectionState);
            switch (this.peerConnection.connectionState) {
                case 'connected':
                    this.updateConnectionStatus('已连接');
                    this.addChatMessage('系统', '视频通话已建立');
                    break;
                case 'disconnected':
                    this.updateConnectionStatus('连接断开');
                    break;
                case 'failed':
                    this.updateConnectionStatus('连接失败');
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
            console.log('Data channel opened');
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
                this.toggleVideoBtn.textContent = this.isVideoEnabled ? '关闭摄像头' : '开启摄像头';
            }
        }
    }

    async toggleAudio() {
        if (this.localStream) {
            const audioTrack = this.localStream.getAudioTracks()[0];
            if (audioTrack) {
                audioTrack.enabled = !audioTrack.enabled;
                this.isAudioEnabled = audioTrack.enabled;
                this.toggleAudioBtn.textContent = this.isAudioEnabled ? '静音' : '取消静音';
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
                this.shareScreenBtn.textContent = '停止分享';
                this.isScreenSharing = true;

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
            this.shareScreenBtn.textContent = '分享屏幕';
            this.isScreenSharing = false;

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
        }
    }

    addChatMessage(sender, text, isLocal = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isLocal ? 'local' : 'remote'}`;
        
        const timestamp = new Date().toLocaleTimeString();
        messageDiv.innerHTML = `
            <div>${text}</div>
            <div class="timestamp">${sender} - ${timestamp}</div>
        `;

        this.chatMessages.appendChild(messageDiv);
        this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
    }

    updateConnectionStatus(status) {
        this.connectionStatus.textContent = status;
        this.connectionStatus.className = status.includes('已连接') ? 'connected' : 
                                        status.includes('连接') ? 'connecting' : 'disconnected';
    }

    toggleRoomButtons(inRoom) {
        this.createRoomBtn.disabled = inRoom;
        this.joinRoomBtn.disabled = inRoom;
        this.leaveRoomBtn.disabled = !inRoom;
        this.roomIdInput.disabled = inRoom;
    }

    generateRoomId() {
        return Math.random().toString(36).substr(2, 9).toUpperCase();
    }

    showOfferInstructions(offer) {
        const instructions = `
要邀请其他人加入，请将以下信息发送给他们：

房间ID: ${this.currentRoomId}

Offer (复制整段):
${JSON.stringify(offer)}

对方需要：
1. 在房间ID框中输入: ${this.currentRoomId}
2. 点击"加入房间"
3. 在浏览器控制台中运行: window.videoChat.setRemoteOffer('上面的Offer JSON')
        `;
        
        console.log(instructions);
        this.addChatMessage('系统', '房间创建成功！请查看浏览器控制台获取邀请信息。');
    }

    showJoinInstructions() {
        const instructions = `
加入房间成功！现在需要创建者的Offer信息。

请在浏览器控制台中运行：
window.videoChat.createAnswer('Offer JSON字符串')

等待创建者提供Offer信息...
        `;
        
        console.log(instructions);
        this.addChatMessage('系统', '请等待创建者提供连接信息，查看浏览器控制台获取详细说明。');
    }

    // Helper methods for manual signaling (for demo purposes)
    async setRemoteOffer(offerJson) {
        try {
            const offer = JSON.parse(offerJson);
            await this.peerConnection.setRemoteDescription(offer);
            
            const answer = await this.peerConnection.createAnswer();
            await this.peerConnection.setLocalDescription(answer);
            
            console.log('Answer created:', answer);
            console.log('发送此Answer给创建者:', JSON.stringify(answer));
            
            this.addChatMessage('系统', '已处理Offer，请将Answer发送给创建者');
        } catch (error) {
            console.error('处理Offer失败:', error);
        }
    }

    async setRemoteAnswer(answerJson) {
        try {
            const answer = JSON.parse(answerJson);
            await this.peerConnection.setRemoteDescription(answer);
            
            this.addChatMessage('系统', '连接建立成功！');
        } catch (error) {
            console.error('处理Answer失败:', error);
        }
    }
}

// Initialize the video chat application
document.addEventListener('DOMContentLoaded', () => {
    window.videoChat = new WebRTCVideoChat();
});

// Utility functions for manual signaling (for demo purposes)
window.setOffer = (offerJson) => {
    if (window.videoChat) {
        window.videoChat.setRemoteOffer(offerJson);
    }
};

window.setAnswer = (answerJson) => {
    if (window.videoChat) {
        window.videoChat.setRemoteAnswer(answerJson);
    }
};
