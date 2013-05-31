(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function EditorStack( options ) {
    var self = this;
    self.options = options;
    self.editors = [];
  }

  $.extend( EditorStack.prototype, {
    ownedControl:     function(c) { return $(this.options.selector + "-" + c) },
    saveChangesButton: function() { return this.ownedControl("save-changes"); },
    saveAndNew:        function() { return this.ownedControl("save-and-new"); },
    saveAndContinue:   function() { return this.ownedControl("save-and-continue"); },
    backButton:        function() { return this.ownedControl("back-button");  },
    cancelButton:      function() { return this.ownedControl("cancel-button"); },
    addNewButton:      function() { return this.ownedControl("add-new"); },
    commandMenu:       function() { return this.ownedControl("command-menu"); },
    description:       function() { return this.ownedControl("description"); },
    chooseExistingButton: function() { return this.ownedControl("choose-existing"); },
    attach: function() {
      var self = this;
      console.log("Attaching editor stack to DOM");
      self.backButton().click( function(e) {
        e.preventDefault();
        return self.popActiveEditor();
      });
      self.cancelButton().click( function(e) {
        e.preventDefault();
        return self.cancelActiveEditor();
      });
      self.saveChangesButton().click( function(e) {
        e.preventDefault();
        return self.submitActiveEditor();
      });
      self.saveAndNew().click( function(e) {
        e.preventDefault();
        return self.submitActiveEditor( function( value ) {
          location.href = global.caribou.api.routeFor("to-route", {
            page: "admin.create-model-instance",
            slug: self.activeEditor().model.slug
          });
        });
      });
      self.saveAndContinue().click( function(e) {
        e.preventDefault();
        return self.submitActiveEditor( function( value ) {
          location.href = global.caribou.api.routeFor("to-route", {
            page: "admin.edit-model-instance",
            slug: self.activeEditor().model.slug,
            id: value.id
          });
        });
      });
      self.addNewButton().click( function(e) {
        e.preventDefault();
        return self.addNew();
      });
      self.chooseExistingButton().click( function(e) {
        e.preventDefault();
        return self.chooseExisting();
      });
      self.commandMenu().on("change", function(e) {
        var r = self.command();
        self.commandMenu().val("");
        return r;
      });
      return self;
    },
    activeEditor: function() { return this.editors[ this.editors.length - 1 ] },
    push: function( editor ) {
      var active = this.activeEditor();
      if ( active ) {
        active.syncFromDOM();
      }
      editor.setStack( this );
      this.editors.push( editor );
      global.caribou.breadcrumbs.push({ text: editor.description() });
      this.description().html( editor.description() );
      this.render();
    },
    pop: function( editor ) {
      var editor = this.editors.pop();
      if ( editor ) {
        global.caribou.breadcrumbs.pop();
        this.render();
        this.description().html( this.activeEditor().description() );
      }
      return editor;
    },
    render: function() {
      var active = this.activeEditor();
      if ( this.editors.length > 1 ) {
        this.saveChangesButton().hide();
        this.saveAndNew().hide();
        this.saveAndContinue().hide();
        this.backButton().show();
        this.cancelButton().show();
      } else {
        if ( !active.value.id && !active.ids ) {
          this.saveChangesButton().text("Create");
        }
        this.saveChangesButton().show();
        this.saveAndNew().show();
        this.saveAndContinue().show();
        this.backButton().hide();
        this.cancelButton().hide();
      }
      active.render( this.options.selector );
      $( this.options.selector ).show();

      active.attach();
      if ( _.contains( _( active ).functions(), "addNew") ) {
        this.addNewButton().show();
      } else {
        this.addNewButton().hide();
      }
      if ( _.contains( _( active ).functions(), "chooseExisting") ) {
        this.chooseExistingButton().show();
      } else {
        this.chooseExistingButton().hide();
      }
      if ( _.contains( _( active ).functions(), "command") ) {
        this.commandMenu().show();
      } else {
        this.commandMenu().hide();
      }
      //global.caribou.status.render().clearMessages();
      return this;
    },
    addNew: function() {
      var active = this.activeEditor();
      active.addNew();
    },
    chooseExisting: function() {
      var active = this.activeEditor();
      active.chooseExisting();
    },
    cancelActiveEditor: function() {
      // confirm?
      var active = this.activeEditor();
      active.cancel();
      this.pop();
      return false;
    },
    command: function() {
      var self = this;
      var active = self.activeEditor();
      var command = self.commandMenu().val();
      return active.command( command );
    },
    popActiveEditor: function() {
      var self = this;
      var active = self.activeEditor();
      active.submit( function( value ) {
        self.pop();
      });
      return false;
    },
    submitActiveEditor: function( next ) {
      var active = this.activeEditor();
      return active.submit( next );
    },
    clear: function() {
      while ( this.editors.pop() ) {
        console.log( "Popping off stale editor" );
      }
    }
  });

  (function ($) {
    $.fn.editorStack = function( options ) {
      var selector = this.selector;
      if ( !options ) {
        if ( $(this.selector).data("stack") ) {
          return $(this.selector).data("stack");
        }
      }
      var opts = $.extend( options, { selector: selector } );
      var stack = new EditorStack( opts );
      this.data({ stack: stack });
      stack.attach();
      return stack;
    }
  })(jQuery);

  editors.EditorStack = EditorStack;
})(window);
