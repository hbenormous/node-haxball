const chatHistoryLimit = 500, gameStateGUIUpdateFrameInterval = 30;
var roomFrame, canvasContainer, roomData, chatApi, room, API, keyHandler, sound, rendererParams, renderer;
var gameTime, redScore, blueScore, gameTime_ot, gameTime_m1, gameTime_m2, gameTime_s1, gameTime_s2;

function loadImage(path){
  return new Promise((resolve, reject)=>{
    var img = document.createElement("img");
    img.src = path;
    img.onload = ()=>{
      resolve(img);
    };
    img.onerror = (err)=>{
      reject(err);
    };
  });
}

function Sound(){
  this.audio = new AudioContext(); // c
  this.gain = this.audio.createGain(); // ag
  this.gain.gain.value = 1;
  this.gain.connect(this.audio.destination);
  var that = this;
  this.loadSound = function(path){
    return new Promise((resolve, reject)=>{
      fetch(path).then((response) => {
        if (!response.ok) {
          reject();
          return;
        }
        return response.arrayBuffer();
      }).then((arrayBuffer) => {
        return that.audio.decodeAudioData(arrayBuffer, resolve, reject);
      }).catch(reject);
    });
  };
  this.playSound = function(sound){
    var bufferSource = that.audio.createBufferSource();
    bufferSource.buffer = sound;
    bufferSource.connect(that.gain);
    bufferSource.start();
  };
}

function GameKeysHandler(){
  this.keyState = 0;
  
  var that = this, keys = new Map();
  keys.set("ArrowUp", "Up");
  keys.set("KeyW", "Up");
  keys.set("ArrowDown", "Down");
  keys.set("KeyS", "Down");
  keys.set("ArrowLeft", "Left");
  keys.set("KeyA", "Left");
  keys.set("ArrowRight", "Right");
  keys.set("KeyD", "Right");
  keys.set("KeyX", "Kick");
  keys.set("Space", "Kick");
  keys.set("ControlLeft", "Kick");
  keys.set("ControlRight", "Kick");
  keys.set("ShiftLeft", "Kick");
  keys.set("ShiftRight", "Kick");
  keys.set("Numpad0", "Kick");

  var keyValue = function (key) {
    switch (keys.get(key)) {
      case "Down":
        return 2;
      case "Kick":
        return 16;
      case "Left":
        return 4;
      case "Right":
        return 8;
      case "Up":
        return 1;
      default:
        return 0;
    }
  };
  this.pressKey = function(key){
    that.keyState |= keyValue(key);
    room.setKeyState(that.keyState);
  };
  this.releaseKey = function(key){
    that.keyState &= ~keyValue(key);
    room.setKeyState(that.keyState);
  };
  this.reset = function(){
    if (that.keyState==0)
      return;
    that.keyState = 0;
    room.setKeyState(0);
  }
};

function updateGUI(){
  roomFrame.style.display = rendererParams.paintGame ? "none" : "block";
  canvasContainer.style.display = rendererParams.paintGame ? "block" : "none";
  if (!rendererParams.paintGame)
    roomFrame.contentWindow.update(API, room, roomData);
}

var oldGUIValues = {};

function updateGameStateGUI(gameState){
  var _redScore = gameState.Pb, _blueScore = gameState.Kb;
  if (oldGUIValues.redScore!=_redScore){
    redScore.innerText = ""+_redScore;
    oldGUIValues.redScore = _redScore;
  }
  if (oldGUIValues.blueScore!=_blueScore){
    blueScore.innerText = ""+_blueScore;
    oldGUIValues.blueScore = _blueScore;
  }
  var totalGameTime = 60*gameState.Da, elapsedGameTime = gameState.Hc|0;
  var s = elapsedGameTime%60, m = (elapsedGameTime/60)|0;
  if (elapsedGameTime<totalGameTime && elapsedGameTime>totalGameTime-30){
    if (!oldGUIValues.timeWarningActive){
      gameTime.classList.add("time-warn");
      oldGUIValues.timeWarningActive = true;
    }
  }
  else if (oldGUIValues.timeWarningActive){
    gameTime.classList.remove("time-warn");
    oldGUIValues.timeWarningActive = false;
  }
  if (totalGameTime!=0 && elapsedGameTime>totalGameTime){
    if (!oldGUIValues.overtimeActive){
      gameTime_ot.classList.add("on");
      oldGUIValues.overtimeActive = true;
    }
  }
  else if (oldGUIValues.overtimeActive){
    gameTime_ot.classList.remove("on");
    oldGUIValues.overtimeActive = false;
  }
  var m1 = ((m/10)|0)%10, m2 = m%10, s1 = ((s/10)|0)%10, s2 = s%10;
  if (oldGUIValues.m1!=m1){
    gameTime_m1.innerText = ""+m1;
    oldGUIValues.m1 = m1;
  }
  if (oldGUIValues.m2!=m2){
    gameTime_m2.innerText = ""+m2;
    oldGUIValues.m2 = m2;
  }
  if (oldGUIValues.s1!=s1){
    gameTime_s1.innerText = ""+s1;
    oldGUIValues.s1 = s1;
  }
  // we dont need check for s2 because this function runs once in each second, therefore the last digit should always be different.
  //if (oldGUIValues.s2!=s2){
  gameTime_s2.innerText = ""+s2;
  //oldGUIValues.s2 = s2;
  //}
}

function analyzeChatCommand(msg){
  if (msg.charAt(0)!="/")
    return false;
  if (msg.length==1)
    return true;
  var {D, J, K, q} = API.Impl.Utils;
  msg = J.Gs(D.substr(msg, 1, null)).split(" ");
  switch (msg[0]) {
    case "avatar":
      if (msg.length==2){
        room.setAvatar(msg[1]);
        chatApi.receiveNotice("Avatar set");
      }
      break;
    case "checksum":
      var d = room.getRoomDataOriginal().o.S;
      msg = d.w;
      if (d.Pe())
        chatApi.receiveNotice('Current stadium is original: "' + msg + '"')
      else{
        d = J.Vg(d.Sj(), 8); // calculate checksum
        chatApi.receiveNotice('Stadium: "' + msg + '" (checksum: ' + d + ")")
      }
      break;
    case "clear_avatar":
      room.setAvatar(null);
      chatApi.receiveNotice("Avatar cleared");
      break;
    case "clear_bans":
      if (room.isHost){
        room.clearBans(null);
        chatApi.receiveNotice("All bans have been cleared");
      }
      else
        chatApi.receiveNotice("Only the host can clear bans");
      break;
    case "set_password":
      if (msg.length==2){
        if (room.isHost){
          room.setProperties({password: msg[1]});
          chatApi.receiveNotice("Password set");
        }
        else
          chatApi.receiveNotice("Only the host can change the password");
      }
      break;
    case "clear_password":
      if (room.isHost){
        room.setProperties({password: null});
        chatApi.receiveNotice("Password cleared");
      }
      else
        chatApi.receiveNotice("Only the host can change the password");
      break;
    case "colors":
      try {
        var teamId = (msg[1]=="blue") ? 2 : 1;
        var angle = msg[2];
        if (angle=="clear"){
          angle = 0;
          msg = [];
        }
        else
          msg.splice(0, 3);
        room.setTeamColors(teamId, angle, ...msg);
      } catch (g) {
        msg = g instanceof q ? g.Ta : g;
        if (typeof msg == "string")
          chatApi.receiveNotice(msg);
      }
      break;
    case "extrapolation":
      if (msg.length==2){
        msg = K.parseInt(msg[1]);
        if (msg!=null){ // && -200 <= msg && 200 >= msg
          room.setExtrapolation(msg),
          chatApi.receiveNotice("Extrapolation set to " + msg + " msec");
        }
        else
          chatApi.receiveNotice("Extrapolation must be a value between -200 and 200 milliseconds");
      }
      else
        chatApi.receiveNotice("Extrapolation requires a value in milliseconds.");
      break;
    case "handicap":
      if (msg.length==2){
        msg = K.parseInt(msg[1]);
        if (msg!=null){ // && 0 <= msg && 300 >= msg
          room.setHandicap(msg);
          chatApi.receiveNotice("Ping handicap set to " + msg + " msec");
        }
        else
          chatApi.receiveNotice("Ping handicap must be a value between 0 and 300 milliseconds");
      }
      else
        chatApi.receiveNotice("Ping handicap requires a value in milliseconds.");
      break;
    case "kick_ratelimit":
      if (msg.length<4)
        chatApi.receiveNotice("Usage: /kick_ratelimit <min> <rate> <burst>");
      else {
        var d = K.parseInt(msg[1]), e = K.parseInt(msg[2]);
        msg = K.parseInt(msg[3]);
        if (d==null || e==null || msg==null)
          chatApi.receiveNotice("Invalid arguments");
        else
          room.setKickRateLimit(d, e, msg);
      }
      break;
    case "recaptcha":
      if (!room.isHost) 
        chatApi.receiveNotice("Only the host can set recaptcha mode");
      else
        try {
          if (msg.length==2) {
            switch (msg[1]) {
              case "off":
                e = false;
                break;
              case "on":
                e = true;
                break;
              default:
                throw new q(null);
            }
            room.setRecaptcha(e);
            chatApi.receiveNotice("Room join Recaptcha " + (e ? "enabled" : "disabled"));
          } else throw new q(null);
        } catch (g) {
          chatApi.receiveNotice("Usage: /recaptcha <on|off>");
        }
      break;
    case "store":
      var f = room.getRoomDataOriginal().o.S;
      if (f.Pe())
        chatApi.receiveNotice("Can't store default stadium.");
      else {
        chatApi.receiveNotice("Not implemented to keep the web examples simple.");
        //insertStadium({name: f.w, contents: API.Utils.exportStadium(f)}).then(()=>{
          //chatApi.receiveNotice("Stadium stored");
        //}, ()=>{
          //chatApi.receiveNotice("Couldn't store stadium");
        //});
      };
      break;
    default:
      chatApi.receiveNotice('Unrecognized command: "' + msg[0] + '"');
  }
  return true;
}

window.onKeyDown = function(event){
  room._onKeyDown(event); // This triggers the onKeyDown callback for all roomConfigs, plugins and renderers.
  switch (event.keyCode) {
    case 9:
    case 13:{
      chatApi.focusOnChat();
      event.preventDefault();
      break;
    }
    case 27:{
      rendererParams.paintGame = (!!roomData.o.K) && (!rendererParams.paintGame);
      updateGUI();
      event.preventDefault();
      break;
    }
    case 80:{
      room.pauseGame();
      event.preventDefault();
      break;
    }
    default:
      keyHandler.pressKey(event.code);
  }
};

window.onKeyUp = function(event){
  room._onKeyUp(event); // This triggers the onKeyUp callback for all roomConfigs, plugins and renderers.
  keyHandler.releaseKey(event.code);
};

window.onRoomLeave = function(){
  window.onbeforeunload = null;
  window.document.removeEventListener("focusout", keyHandler.reset);
  window.document.removeEventListener("keyup", window.onKeyUp);
  window.document.removeEventListener("keydown", window.onKeyDown);
  room.leave();
  window.close();
};

window.onload = ()=>{
  window.onload = null;
  var tmp = document.getElementsByClassName("canvasSubContainer");
  roomFrame = tmp.item(0);
  canvasContainer = tmp.item(1);
  var canvas = canvasContainer.children.item(0);
  var gameStateContainer = canvasContainer.children.item(1);
  var scoreBoard = gameStateContainer.children.item(0);
  redScore = scoreBoard.children.item(1);
  blueScore = scoreBoard.children.item(3);
  gameTime = gameStateContainer.children.item(1);
  gameTime_ot = gameTime.children.item(0);
  gameTime_m1 = gameTime.children.item(1);
  gameTime_m2 = gameTime.children.item(2);
  gameTime_s1 = gameTime.children.item(4);
  gameTime_s2 = gameTime.children.item(5);
  var chatLog = document.getElementsByClassName("chatLog").item(0);
  var chatInput = document.getElementsByClassName("chatInput").item(0);
  var bSendChat = chatInput.children.item(1);
  chatInput = chatInput.children.item(0);
  var scrollTopRef = -1;
  chatLog.onscroll = function(event){
    if (chatLog.scrollTop>=chatLog.scrollHeight - chatLog.clientHeight - 20)
      scrollTopRef = -1;
    else
      scrollTopRef = chatLog.scrollTop;
  };
  function addChatRow({type, className, content, color, font}){
    var e = document.createElement("p");
    if (type==0 && className!=null)
      e.className = className;
    else if (type==1){
      e.className = "announcement";
      if (color>=0)
        e.style.color = API.Utils.numberToColor(color);
      switch (font){
        case 1:
          e.style.fontWeight = "bold";
          break;
        case 2:
          e.style.fontStyle = "italic";
          break;
        case 3:
          e.style.fontSize = "12px";
          break;
        case 4:
          e.style.fontWeight = "bold";
          e.style.fontSize = "12px";
          break;
        case 5:
          e.style.fontStyle = "italic";
          e.style.fontSize = "12px";
          break;
      }
    }
    e.innerText = content;
    if (chatLog.children.length>=chatHistoryLimit)
      chatLog.children.item(0).remove();
    chatLog.appendChild(e);
    if (scrollTopRef==-1)
      chatLog.scrollTop = chatLog.scrollHeight - chatLog.clientHeight;
  }
  function sendChat(){
    var chatText = chatInput.value;
    if (chatText.length>0 && !analyzeChatCommand(chatText))
      room.sendChat(chatText);
    chatInput.value = "";
    chatInput.blur();
  }
  bSendChat.onclick = sendChat;
  chatInput.onkeydown = function(event){
    switch (event.keyCode) {
      case 9:
        //b.Bc.Mb.hidden || (b.Bc.qo(), c.preventDefault());
        break;
      case 13:
        sendChat();
        break;
      case 27:
        chatInput.value = "";
        chatInput.blur();
        //b.Bc.Mb.hidden ? ((b.gb.value = ""), b.gb.blur()) : b.Bc.Qh();
        break;
      case 38:
        //b.Bc.Qj(-1);
        break;
      case 40:
        //b.Bc.Qj(1);
    }
    event.stopPropagation();
  }
  var chatFocus = false, chatFocusTimeout = null;
  function onFocusChange(focus){
    chatFocus = focus;
    if (chatFocusTimeout!=null)
      return;
    chatFocusTimeout = setTimeout(function () {
      chatFocusTimeout = null;
      room.sendChatIndicator(chatFocus);
    }, 1000);
    room.sendChatIndicator(chatFocus);
  };
  chatInput.onfocus = ()=>{
    onFocusChange(true);
  };
  chatInput.onblur = ()=>{
    onFocusChange(false);
  };
  chatApi = {
    receiveChatMessage: function(nick, msg){
      addChatRow({type: 0, content: nick + " : " + msg, color: 1, font: 1})
    },
    receiveAnnouncement: function(msg, color, style){
      addChatRow({type: 1, content: msg, color: color, font: style})
    },
    receiveNotice: function(msg){
      addChatRow({type: 0, content: msg, className: "notice"})
    },
    focusOnChat: function(){
      chatInput.focus();
    }
  };
  var roomCallback = function(_room){
    room = _room;
    roomData = room.getRoomDataOriginal();
    keyHandler = new GameKeysHandler();
    sound = new Sound();
    var {p: Team} = API.Impl.Core;
    Team.byId = [
      Team.Ia,
      Team.fa,
      Team.xa
    ];
    document.addEventListener("keydown", window.onKeyDown);
    document.addEventListener("keyup", window.onKeyUp);
    document.addEventListener("focusout", keyHandler.reset);
    window.onbeforeunload = function () {
      return "Are you sure you want to leave the room?";
    };
    function by(playerObj){
      return (null == playerObj ? "" : " by [" + playerObj.V + "]" + playerObj.w);
    }
    room.onAfterRoomLink = (roomLink, customData)=>{
      window.roomLink = roomLink;
    };
    room.onAfterPlayerChat = function(id, message, customData){
      var playerObj = roomData.o.I.find((x)=>x.V==id);
      if (!playerObj)
        return;
      chatApi.receiveChatMessage("[" + playerObj.V + "]" + playerObj.w, message); // d ? "highlight" : null
      sound.playSound(sound.chat);//sound.highlight
    };
    room.onAfterPlayerJoin = function(playerObj, customData){
      chatApi.receiveNotice("[" + playerObj.V + "]" + playerObj.w + " has joined");
      sound.playSound(sound.join);
      updateGUI();
    };
    room.onAfterPlayerLeave = function (playerObj, reason, isBanned, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      if (reason != null)
        chatApi.receiveNotice("[" + playerObj.V + "]" + playerObj.w + " was " + (isBanned ? "banned" : "kicked") + by(byPlayerObj) + ("" != reason ? " (" + reason + ")" : ""));
      else
        chatApi.receiveNotice("[" + playerObj.V + "]" + playerObj.w + " has left");
      sound.playSound(sound.leave);
      updateGUI();
    };
    room.onAfterAnnouncement = function (msg, color, style, _sound, customData) {
      chatApi.receiveAnnouncement(msg, color, style);
      switch (_sound) {
        case 1:
          sound.playSound(sound.chat);
          break;
        case 2:
          sound.playSound(sound.highlight);
          break;
      }
    };
    room.onAfterPlayerBallKick = function (customData) {
      sound.playSound(sound.kick);
    };
    room.onAfterTeamGoal = function (teamId, customData) {
      sound.playSound(sound.goal);
    };
    room.onAfterGameEnd = function (winningTeamId, customData) {
      chatApi.receiveNotice("" + Team.byId[winningTeamId].w + " team won the match");
    };
    room.onAfterGamePauseChange = function (paused, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      if (paused)
        chatApi.receiveNotice("Game paused" + by(byPlayerObj));
      updateGUI();
    };
    room.onAfterGameStart = function (byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      chatApi.receiveNotice("Game started" + by(byPlayerObj));
      rendererParams.paintGame = true;
      updateGUI();
    };
    room.onAfterGameStop = function (byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      if (byPlayerObj!=null)
        chatApi.receiveNotice("Game stopped" + by(byPlayerObj));
      rendererParams.paintGame = false;
      updateGUI();
    };
    room.onAfterStadiumChange = function (stadium, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      if (!stadium.Pe()) {
        var checksum = API.Impl.Utils.J.Vg(stadium.Sj(), 8);
        chatApi.receiveNotice('Stadium "' + stadium.w + '" (' + checksum + ") loaded" + by(byPlayerObj));
      }
      updateGUI();
    };
    room.onAfterPlayerSyncChange = function (playerId, value, customData) {
      var playerObj = roomData.o.I.find((x)=>x.V==playerId);
      chatApi.receiveNotice("[" + playerObj.V + "]" + playerObj.w + " " + (playerObj.Ld ? "has desynchronized" : "is back in sync"));
    };
    room.onAfterPlayerTeamChange = function (id, teamId, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId), playerObj = roomData.o.I.find((x)=>x.V==id), teamObj = Team.byId[teamId];
      if (roomData.o.K!=null)
        chatApi.receiveNotice("[" + playerObj.V + "]" + playerObj.w + " was moved to " + teamObj.w + by(byPlayerObj));
      updateGUI();
    };
    room.onAfterAutoTeams = function (playerId1, teamId1, playerId2, teamId2, byId, customData) {
      room.onAfterPlayerTeamChange(playerId1, teamId1, byId, customData);
      if (playerId2!=null && teamId2!=null)
        room.onAfterPlayerTeamChange(playerId2, teamId2, byId, customData);
    };
    room.onAfterPlayerAdminChange = function (id, isAdmin, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId), playerObj = roomData.o.I.find((x)=>x.V==id);
      chatApi.receiveNotice((playerObj.cb ? ("[" + playerObj.V + "]" + playerObj.w + " was given admin rights") : ("[" + playerObj.V + "]" + playerObj.w + "'s admin rights were taken away")) + by(byPlayerObj));
      updateGUI();
    };
    room.onAfterKickRateLimitChange = function (min, rate, burst, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      chatApi.receiveNotice("Kick Rate Limit set to (min: " + min + ", rate: " + rate + ", burst: " + burst + ")" + by(byPlayerObj));
    };
    room.onAfterCustomEvent = function (type, data, byId, customData) {
      var byPlayerObj = roomData.o.I.find((x)=>x.V==byId);
      chatApi.receiveNotice("Custom Event triggered (type: " + type + ", data: [" + JSON.stringify(data) + "])" + by(byPlayerObj));
    };
    room.onAfterScoreLimitChange = function (value, byId, customData) {
      updateGUI();
    };
    room.onAfterTimeLimitChange = function (value, byId, customData) {
      updateGUI();
    };
    room.onAfterTeamsLockChange = function (value, byId, customData) {
      updateGUI();
    };
    room.onAfterPingData = function (array, customData) {
      updateGUI();
    };
    Promise.all([sound.loadSound("./sounds/chat.ogg"), sound.loadSound("./sounds/crowd.ogg"), sound.loadSound("./sounds/goal.ogg"), sound.loadSound("./sounds/highlight.wav"), sound.loadSound("./sounds/join.ogg"), sound.loadSound("./sounds/kick.ogg"), sound.loadSound("./sounds/leave.ogg")]).then((sounds)=>{
      sound.chat = sounds[0];
      sound.crowd = sounds[1];
      sound.goal = sounds[2];
      sound.highlight = sounds[3];
      sound.join = sounds[4];
      sound.kick = sounds[5];
      sound.leave = sounds[6];
    }, (err)=>{
      console.log(err);
      alert("Error loading sounds. Look at console for error details.");
    });
    Promise.all([loadImage("./images/grass.png"), loadImage("./images/concrete.png"), loadImage("./images/concrete2.png"), loadImage("./images/typing.png")]).then((images)=>{
      var counter = 0;
      rendererParams = {
        canvas: canvas, 
        images: {
          grass: images[0],
          concrete: images[1],
          concrete2: images[2],
          typing: images[3]
        },
        paintGame: !!roomData.o.K,
        onRequestAnimationFrame: ()=>{
          if (!roomData.o.K)
            return;
          counter++;
          if (counter>gameStateGUIUpdateFrameInterval){
            counter=0;
            updateGameStateGUI(roomData.o.K);
          }
        }
      };
      room.setRenderer(new renderers.defaultRenderer(API, rendererParams));
      updateGUI();
    }, (err)=>{
      console.log(err);
      alert("Error loading images. Look at console for error details.");
    });
  };
  API = init(false, roomCallback);
};
