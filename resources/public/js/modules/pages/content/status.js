(function (global) {
    function _status() {
      var messages;
      var status = {
        addMessageOfType: function( message, type ) {
          messages[type].push( message );
          return status;
        },
        addSuccessMessage: function( message ) { return status.addMessageOfType( message, "success" ) },
        addErrorMessage:   function( message ) { return status.addMessageOfType( message, "error" ) },
        addInfoMessage:    function( message ) { return status.addMessageOfType( message, "info" ) },
        clearMessages: function() {
          messages = { success: [], error: [], info: [] };
          return status;
        },
        render: function( selector ) {
          if ( !selector ) { selector = ".status-messages" }
          var count = 0;
          _( messages ).chain().keys().each( function( key ) {
            var list = "";
            var lt = _.template("<li>{{message}}</li>");
            _( messages[key] ).each( function( message ) {
              list = list + lt({message:message});
              count++;
            });
            $( selector + ".alert-" + key ).find("ul").remove();
            if (list.length) {
              $( selector + ".alert-" + key ).append("<ul>" + list + "</ul>").show();
            }
          });
          return status;
        }
      };

      status.clearMessages();
      return status;
    }

    global.caribou = global.caribou || {};
    global.caribou.status = _status();
})(window);
