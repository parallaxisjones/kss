var Keylogger;

(function() {

  var Keystroke = Class.$extend({
    __init__: function(json) {
      if (json) this.fromJSON(json);
      else throw new Error("Properties required for Keystroke!");
    },

    __instancevars__: ['keycode', 'pressLength', 'timestamp']
  });

  var _createKeydownEventHandler = function(keylogger) { 
    return function(e) {
      if (keylogger._keys[e.which] == -1)
        keylogger._keys[e.which] = (new Date()).getTime();
    };
  };

  var _createKeyupEventHandler = function(keylogger) {
    return function(e) {
      if (keylogger._keys[e.which] == -1) {
        throw new Error("Key not pressed!");
      }
      var pressLength = (new Date()).getTime() - keylogger._keys[e.which];
      var keycode = e.which;
      var timestamp = keylogger._keys[e.which];
      var keystroke = new Keystroke({
        pressLength: pressLength * 1e-3,
        keycode: keycode,
        timestamp: timestamp
      });

      keylogger.notifyListeners(keystroke);
      keylogger._keys[e.which] = -1;
    };
  };
    
  var Keylogger_ = Class.$extend({
    // __init__: Creates a keylogger that attaches to the given window.
    __init__: function(window) {
      this._window = window;
      this._listeners = [];
      
      // this._keys stores state information about what key is currently
      //  pressed on the window at any given point in time. If the key is
      //  not currently pressed, the value in the array will be -1. If the
      //  key is pressed, the value will be the timestamp at which the key
      //  was pressed.
      this._keys = new Array(256);
      for (var i = 0; i < 256; ++i) this._keys[i] = -1;

      this._onKeydown = _createKeydownEventHandler(this);
      this._onKeyup = _createKeyupEventHandler(this);
    },

    // attachListener: Attaches a listener to Keylogger.
    //  Listeners to this Keylogger are functions that take in one argument:
    //  the Keystroke object representing the key pressed.
    attachListener: function(listener) {
      this._listeners.push(listener);
    },

    // detatchListener: Detatches a listener from the Keylogger.
    detatchListener: function(listener) {
      var index = this._listeners.indexOf(listener);
      if (index != -1) this._listeners.splice(index,1);
      else throw new Error("Listener not found");
    },

    // notifyListeners: Notifies all listeners to this Keylogger that a key
    //  has been pressed.
    notifyListeners: function(keystroke) {
      for (var i = 0; i < this._listeners.length; ++i) {
        this._listeners[i](keystroke);
      }
    },

    // start: Starts the operation of this Keylogger. From the time this
    //  function is called, all of the keys pressed while the user is in the
    //  current window will be logged and sent to listeners.
    start: function() {
      $(this._window).bind('keydown', this._onKeydown);
      $(this._window).bind('keyup', this._onKeyup);
    },

    // stop: Stops the operation of the Keylogger.
    stop: function() {
      $(this._window).unbind('keydown', this._onKeydown);
      $(this._window).unbind('keyup', this._onKeyup);
    },

  });

  Keylogger = Keylogger_;

})();
