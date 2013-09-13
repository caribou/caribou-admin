//-------------------------------------------------------
// editors/base.js
// This is the core of the editing system used by the
// admin.
//-------------------------------------------------------

(function (global) {

  //-------------------------------------------------------
  // Editor is the parent class of all editors.  An editor
  // has a value (some JS value or object) and knows how
  // to sync values to and from the DOM.
  //-------------------------------------------------------
  function Editor( options ) {
    var self = this;

    if ( options.from ) {
      self.initFrom( options.from );
    }
    self.model  = options.model || self.model;
    self.value  = options.value || self.value;
    self.locale = options.locale || self.locale;
    self.options = options;

    // the stack is discovered this way, see stack() below
    self._stack = null;

    return self;
  }

  $.extend( Editor.prototype, {
    api: function() { return global.caribou.api },

    initFrom: function( parent ) {
      var self = this;
      self.parent = parent;
      self.model = parent.model;
      self.value = parent.value;
      self.locale = parent.locale;
    },

    // retrieves a value from the editor's state
    get: function( key, def ) {
      var bits = key.split(/\./);
      var current = this.value;
      while ( current ) {
        var k = bits.shift();
        if (!k) { break; }
        current = current[k];
      }
      if (!current) { return def };
      return current;
    },
    // pushes a value into the editor's state
    set: function( key, value ) {
      var bits = key.split(/\./);
      var current = this.value;
      while ( 1 ) {
        if ( bits.length === 1 ) {
          current[bits[0]] = value;
          break;
        }
        var k = bits.shift();
        current = current[k];
      }
      return this;
    },
    render: function( selector ) {
      this.selector = selector;
      $(selector).empty().html( this.template );
      this.syncToDOM();
    },
    stack: function() {
      if ( this._stack ) { return this._stack }
      return this.parent.stack();
    },
    setStack: function(s) { this._stack = s },
    _callback: function( name, value, next ) {
      var f = this.options[name] || function ( value, next ) { if (next) { next( value ) } };
      f( value, next );
    },
    callback: function( name, next ) { this._callback(name, this.value, next) },
    callbackWithValue: function( name, value, next ) { this._callback(name, value, next) },
    submit: function( next ) {
      this.syncFromDOM();
      this.callback("submit", next);
    },
    cancel: function( next ) {
      this.syncFromDOM();
      this.callback("cancel", next);
    },
    prepareForUpdate: function( data ) {
      var blacklist = _( this.model.fields ).chain().filter(
        function(f) {
          if ( f.type === "id" ) { return false }
          if ( f.slug === "type" ) { return false }
          if ( f.type === "integer" && f.slug.match(/(^|_|-)id$/) ) { return false }
          if ( f.type === "part" || f.type == "enum" || f.type == "asset" ) { return true } // because the id field is present
          if ( f.type === "password" && data[f.slug] === null ) { return true }
          if ( f.type === "link" || f.type === "collection" ) { return true }
          return !f.editable;
        }).map( function(f) { return f.slug }).value();
      return _( data ).omit( blacklist );
    },
    description: function() { return this.model.slug },
    attach:      function() {},
    syncToDOM:   function() {},
    syncFromDOM: function() {},
    load:        function( success ) {},
    refresh:     function( success ) {
      var self = this;
      self.load( function( data, error, jqxhr ) {
        self.template = data.template;
        $( self.selector ).html( self.template );
        self.attach();
        if (success) { success( data ) }
      });
    },
    on: function( event, fn ) { console.error(this + " can't handle " + event); }
  });

  //-------------------------------------------------------
  // FieldEditor is the parent class of each mini editor
  // that represents a single field within a larger editor.
  // There is generally one of these per caribou "field"
  // within a given model.  See editors/fields.js to
  // see examples of how specific types of fields are
  // built.
  //-------------------------------------------------------
  function FieldEditor( options ) {
    var self = this;
    Editor.call( self, options );
    self.field = options.field;
    self.parent = options.parent;
    return self;
  }

  $.extend( FieldEditor.prototype, Editor.prototype, {
    description:   function() { return this.field.slug },
    selector:      function() { return this.parent.selector + " input[name=" + this.field.slug + "]" },
    element:       function() {
      var self = this;
      if (!self._element) {
        self._element = $(self.selector());
      }
      return self._element;
    },
    syncToDOM:     function() { $( this.selector() ).val( this.value ) },
    syncFromDOM:   function() { this.value = $( this.selector() ).val() },
    syncValueFrom: function(from) { this.value = from.get( this.field.slug ) },
    on: function( event, fn ) {
      if ( event === "caribou:edit" ) {
        event = "change keyup";
      }
      $( this.selector() ).on( event, fn );
    }
  });

  //-------------------------------------------------------
  // The EditorRegistry maps model slugs to editors,
  // and is where you specify which editor is to be used
  // for which model.  If you don't specify anything,
  // the system will pick the generic ModelEditor, which
  // should allow you to edit most things.
  //-------------------------------------------------------

  function EditorRegistry() {
    this.map = {};
  }
  $.extend( EditorRegistry.prototype, {
    register: function( model, editorClass ) { this.map[model] = editorClass },
    editor: function( options ) {
      var model = options.model;
      var content = options.value;
      if ( this.map[model.slug] ) {
        var editorClass = this.map[model.slug];
        return new editorClass( options );
      }
      console.log("No specific editor for " + model.slug + " so using generic");
      return new global.caribou.editors.ModelEditor( options );
    }
  });

  //-------------------------------------------------------
  // Export everything through the global (usually "window")
  // Other scripts that create subclasses of these
  // components will push them into this global
  // so they are available everywhere.
  //-------------------------------------------------------
  global.caribou = global.caribou || {};
  global.caribou.editors = {
    registry: new EditorRegistry(),
    Editor: Editor,
    FieldEditor: FieldEditor
  };
})(window);

