const { OperationType, VariableType, ConnectionState, AllowFlags, Callback, Utils, Room, Replay, Query, RoomConfig, Plugin, Renderer, Errors, Language, Impl } = API = require("../../src/index");

Utils.generateAuth().then(([authKey, authObj])=>{
  Room.join({
    id: "Olnit_iGRWs",
    password: "password"
  }, {
    storage: {
      player_name: "wxyz-abcd",
      avatar: "👽",
      player_auth_key: authKey
    }, 
    authObj: authObj,
    config: null, // example roomConfig usage: new autoPlay_followBall(API) // look at examples/roomConfigs/method2 folder for related examples.
    renderer: null, // example renderer usage: new defaultRenderer(API, {canvas: ..., images: {grass: ..., concrete: ..., concrete2: ..., typing: ...}, paintGame: true}) // look at examples_web folder for usage with room.setRenderer instead.
    plugins: [], // example plugin usage: [new autoPlay_followBall(API)] // look at examples/plugins folder for related examples.
    onSuccess: roomCallbacks, // look at examples/roomConfigs/method1 folder for related examples.
    onFailure: (error)=>{
      console.log("Unable to join room...", error);
      process.exit(0);
    },
    onLeave: (msg)=>{
      console.log("Bot has left the room:", msg);
      process.exit(0);
    }
  });
});

function roomCallbacks(room){ // "roomCallbacks" examples start from here. // look at examples/roomConfigs/method1 folder for related examples.
  console.log("joined room");
}
