(function(global) {

  if (!global.caribou || !global.caribou.api) {
    throw "Caribou has not been loaded";
  }

  //===============================================
  // This acts as a kind of NSUserDefaults as
  // found in OSX and iOS. The dumb implementation
  // uses plaintext cookies, but this could be
  // swapped out to use any backing store you want.
  //===============================================
  function PreferencesManager() {}
  $.extend(PreferencesManager.prototype, {
    valueForKey: function(k) {
      return global.caribou.api.cookieValue(k);
    },
    setValueForKey: function(v, k) {
      return global.caribou.api.setCookieValue(k, v);
    }
  });

  //=======================================

  function PreferencesPage(options) {
    var self = this;

    options = options || {};
    self.selector = options.selector || ".caribou-preferences";
    self.element = $(self.selector);

    // individual elements
    self.validationRadioButtons = self.element.find("input[name=preferences-validation]");
    self.validationRadioButtons.on("change", function(e) {
      e.stopPropagation();
      var v = self.validation();
      console.log("setting validation level to " + v);
      global.caribou.preferences.preferencesManager.setValueForKey(v, "validationLevel");
    });
    self.render();
  }

  $.extend(PreferencesPage.prototype, {
    validation: function() {
      return this.element.find("input[name=preferences-validation]:checked").val();
    },
    setValidation: function(v) { this.validationRadioButtons.val([v]) },

    render: function() {
      var validationLevel = global.caribou.preferences.preferencesManager.valueForKey("validationLevel");
      this.setValidation(validationLevel);
    }
  });

  global.caribou.preferences = {
    PreferencesPage: PreferencesPage,
    preferencesManager: new PreferencesManager()
  };
})(window);
