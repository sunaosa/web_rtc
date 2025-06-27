# WebRTC 视频聊天项目

一个基于 WebRTC 技术的实时视频聊天应用，支持点对点视频通话、屏幕分享和文字聊天功能。

## 功能特性

- 🎥 **实时视频通话** - 高质量的点对点视频通信
- 🎤 **语音通话** - 清晰的音频传输
- 💬 **实时聊天** - 文字消息即时传递
- 📺 **屏幕分享** - 分享桌面屏幕内容
- 🎛️ **媒体控制** - 摄像头和麦克风开关控制
- 📱 **响应式设计** - 适配各种设备屏幕

## 技术栈

- **WebRTC** - 实时通信协议
- **HTML5** - 页面结构
- **CSS3** - 样式和动画
- **JavaScript (ES6+)** - 应用逻辑
- **MediaDevices API** - 媒体设备访问

## 项目结构

```
├── index.html          # 主页面
├── style.css           # 样式文件
├── script.js           # 主要JavaScript逻辑
└── README.md          # 项目说明
```

## 快速开始

### 1. 运行项目

由于浏览器安全限制，需要通过HTTPS或localhost运行：

```bash
# 方法1: 使用Python简单服务器
python -m http.server 8000

# 方法2: 使用Node.js serve包
npx serve .

# 方法3: 使用Live Server (VS Code插件)
# 右键index.html -> Open with Live Server
```

### 2. 访问应用

打开浏览器访问：
- `http://localhost:8000` (Python)
- `http://localhost:3000` (serve)
- 或Live Server提供的地址

### 3. 使用步骤

#### 创建房间：
1. 点击"创建房间"按钮
2. 系统会生成房间ID
3. 查看浏览器控制台获取邀请信息
4. 将房间ID和连接信息发送给对方

#### 加入房间：
1. 输入房间ID
2. 点击"加入房间"按钮
3. 根据控制台提示完成连接

#### 手动信令（演示用）：
```javascript
// 对方设置Offer
window.setOffer('{"type":"offer",...}')

// 创建者设置Answer  
window.setAnswer('{"type":"answer",...}')
```

## 主要功能

### 视频通话
- 自动获取用户摄像头和麦克风权限
- 实时视频流传输
- 自适应视频质量

### 媒体控制
- **摄像头开关** - 控制视频流
- **麦克风开关** - 控制音频流
- **屏幕分享** - 分享桌面内容

### 实时聊天
- 文字消息即时传递
- 消息时间戳
- 消息发送状态显示

### 连接管理
- 实时连接状态显示
- 房间创建和加入
- 优雅的断开连接

## 浏览器兼容性

支持现代浏览器：
- Chrome 56+
- Firefox 44+
- Safari 11+
- Edge 79+

## 注意事项

### 安全要求
- 必须通过HTTPS或localhost访问
- 需要摄像头和麦克风权限

### 网络要求
- 需要稳定的网络连接
- 建议使用有线网络以获得最佳体验

### 防火墙设置
- 确保WebRTC相关端口未被阻止
- 某些企业网络可能需要特殊配置

## 开发说明

### 自定义配置

修改STUN服务器：
```javascript
this.servers = {
    iceServers: [
        { urls: 'stun:your-stun-server.com:19302' }
    ]
};
```

### 添加TURN服务器（NAT穿透）：
```javascript
this.servers = {
    iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        {
            urls: 'turn:your-turn-server.com:3478',
            username: 'username',
            credential: 'password'
        }
    ]
};
```

## 扩展功能

### 可以添加的功能：
- 多人视频会议
- 录制功能
- 美颜滤镜
- 虚拟背景
- 文件传输
- 信令服务器集成

## 故障排除

### 常见问题：

1. **无法访问摄像头/麦克风**
   - 检查浏览器权限设置
   - 确认使用HTTPS或localhost

2. **连接失败**
   - 检查网络连接
   - 确认防火墙设置
   - 尝试使用TURN服务器

3. **音视频不同步**
   - 检查网络延迟
   - 重新建立连接

## License

MIT License - 可自由使用和修改

## 贡献

欢迎提交Issue和Pull Request来改进项目！
