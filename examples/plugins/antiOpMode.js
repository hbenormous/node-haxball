module.exports = function(API){
  const { OperationType, VariableType, ConnectionState, AllowFlags, Callback, Utils, Room, Replay, Query, RoomConfig, Plugin, Renderer, Errors, Language, Impl } = API;

  Object.setPrototypeOf(this, Plugin.prototype);
  Plugin.call(this, "anti-opMode", true, { // "anti-opMode" is plugin's name, "true" means "activated just after initialization". Every plugin should have a unique name.
    version: "0.1",
    author: "abc",
    description: "This plugin is the fix of the opMode plugin.",
    allowFlags: AllowFlags.CreateRoom // We allow this plugin to be activated on CreateRoom only.
  });

  // parameters are exported so that they can be edited outside this class.
  this.historyLength = this.defineVariable({
    name: "historyLength",
    description: "Number of frame differences to store, per player", 
    type: VariableType.Integer,
    value: 20,
    range: {
      min: 1,
      max: 1000,
      step: 1
    }
  });

  this.allowedBadFrames = this.defineVariable({
    name: "allowedBadFrames",
    description: "Number of bad frame differences allowed, per player", 
    type: VariableType.Integer,
    value: 7,
    range: {
      min: 0,
      max: 1000,
      step: 1
    }
  });

  var room, arrays = [], badCounts = [], thisPlugin = this;

  this.initialize = function(_room){
    room = _room;
  };

  this.finalize = function(){
    room = null;
  };

  this.onPlayerJoin = function(playerObj, customData){
    arrays[playerObj.V] = null;
    badCounts[playerObj.V] = 0;
  };

  this.onPlayerLeave = function(playerObj, reason, isBanned, byId, customData){
    delete arrays[playerObj.V];
    delete badCounts[playerObj.V];
  };

  this.onOperationReceived = function(type, msg, globalFrameNo, clientFrameNo, customData){
    if (type!=OperationType.SendInput) // only look out for input events
      return true;
    var id = msg.byId, diff = clientFrameNo-globalFrameNo, arr = arrays[id];
    if (arr!=null){
      if (arr.length==thisPlugin.historyLength){ // we store the last 20 frame no's for input messages
        var last = arr.shift();
        if (last<2 || diff>5)
          badCounts[id]--;
      }
      arr.push(diff);
      if (diff<2 || diff>5)
        badCounts[id]++;
      if (badCounts[id]>thisPlugin.allowedBadFrames) // if the player sent enough bad frame numbers, kick the player with "bad actor" message.
        throw ""; // this should be commented out if you want to experiment.
    }
    else if (diff<2 || diff>5){
      arrays[id] = [diff];
      badCounts[id] = 1;
    }
	  // enable the below line if you want to debug & experiment.
    // room.sendAnnouncement("id: " + id + " frameDiff: " + diff + " bad count: " + badCounts[id], null, 0xff8888, 0, 0);
    return true;
  };
};