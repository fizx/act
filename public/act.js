function Act(socket, app) {
  var that = this;
  this.app = app || (new Date().getTime() + ":" + Math.floor(Math.random() * 100000));
  this._listeners = {};
  this._data = {};
  this.debounceInterval = 300;
  this._socket = socket;
  
  socket.onmessage = function(message) {
    var data = JSON.parse(message.data);
    for(var key in data) {
      that._set(that.app, key, data[key]);
    }
  }  
  
  this.session = {
    get: function(key) {
      that._addListener(null, key);
      return that._get(null, key);
    },
    set: function(key, value) {
      that._set(null, key, value);
      that._trigger(null, key);
    },
    react: function(inner) { return that.react(inner); }
  };
};

Act.prototype.get = function(url, params, force) {
  var key = this._url(url, params);
  
  this._addListener(this.app, key);
  
  if(force || !this._isPresent(this.app, key)) {
    this._fetch(key);
  }
    console.log("get");
    console.log(this._get(this.app, key));
    // console.log(newData);
  
  return this._get(this.app, key);
};


Act.prototype.set = function(url, params, data) {
  if(!data) { // support shorter constructor that omits params
    data = params;
    params = undefined;
  }
  
  var that = this;
  var key = this._url(url, params);
  
  this._push(url, params, data);
  this._set(this.app, key, data);
};

Act.prototype._fetch = function(url) {
  var that = this;
  console.log("fetching")
  $.getJSON(url, function(data){
    console.log("received")
    that._set(that.app, url, data);
  });
}

Act.prototype._push = function(url, params, data) {
  var that = this;
  var key = this._url(url, params);
  
  $.post(key, JSON.stringify(data), function(newData){
    that._set(that.app, key, newData);
  }, "json");
}

Act.prototype._url = function(url, params) {
  params = $.extend({}, params || {}, { app: this.app });
  var separator = url.indexOf("?") == -1 ? "?" : "&"
  return url + separator + jQuery.param(params);
};

Act.prototype.react = function(inner) {
  var old_context = this._context;
  this._context = inner;
  var value = inner();
  this._context = old_context;
};

Act.prototype.cancel = function(key) {
  socket.send(JSON.stringify({
    action: "cancel",
    app: this.app,
    key: key
  }));
};

Act.prototype._trigger = function(app, key) {
  var listeners = this._getListeners(app, key);
  console.log("trigger " + app + " " + key + " : " + listeners.length);
  for(var i = 0; i < listeners.length; i++) {
    listeners[i]();
  }
}

Act.prototype._getListeners = function(app, key) {
  this._listeners[app] = this._listeners[app] || {};
  return this._listeners[app][key] || [];
}

Act.prototype._get = function(app, key) {
  return this._data[app] && this._data[app][key] || {};
}

Act.prototype._isPresent = function(app, key) {
  return this._data[app] && this._data[app][key];
}

Act.prototype._set = function(app, key, value) {
  this._data[app] = this._data[app] || {};
  this._data[app][key] = value;
  this._trigger(app, key);
}

Act.prototype._unset = function(app, key) {
  if(key && this._data[app]) {
    delete this._data[app][key];
  } else if (app) {
    delete this._data[app];
  }
}

Act.prototype._addListener = function(app, key) {
  if(this._context) {
    this._socket.send(JSON.stringify({
      action: "listen",
      app: app,
      key: key
    }));
    
    this._listeners[app] = this._listeners[app] || {};
    this._listeners[app][key] = this._listeners[app][key] || [];
    this._listeners[app][key].push(this._context);
  }  
}