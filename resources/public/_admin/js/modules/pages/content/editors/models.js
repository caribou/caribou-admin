//-------------------------------------------------------
// editors/models.js
// The generic model editors ("ModelEditor" and
// "BulkModelEditor") are defined here.  They will work
// with pretty much any Caribou model.
//
// This file also currently contains the master map that
// decides which individual field editors should be used
// for each Caribou field type.
//-------------------------------------------------------

(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }
  var preferences = global.caribou.preferences.preferencesManager;

  // code here
  //
  var fieldEditorMap = {
    string:     editors.FieldEditor,
    text:       editors.TextEditor,
    password:   editors.PasswordFieldEditor,
    integer:    editors.FieldEditor,
    decimal:    editors.FieldEditor,
    "enum":     editors.EnumFieldEditor,
    timestamp:  editors.DateFieldEditor,
    "boolean":  editors.CheckBoxEditor,
    asset:      editors.AssetFieldEditor,
    collection: editors.CollectionFieldEditor,
    part:       editors.PartFieldEditor,
    link:       editors.LinkFieldEditor,
    address:    editors.AddressFieldEditor,
    structure:  editors.StructureFieldEditor
    // etc.
  };

  // -------------------------------------------------------
  // ModelEditor is the generic editor that can be used to
  // edit almost any kind of Caribou model.
  //
  // It has a collection of "children", one for each field
  // in the model that is being edited, and it syncs its
  // values to and from those children (which in turn sync
  // their values to and from the DOM).
  // -------------------------------------------------------
  function ModelEditor( options ) {
    var self = this;
    editors.Editor.call( this, options );
    self.constructChildren();
  }

  $.extend( ModelEditor.prototype, editors.Editor.prototype, {
    description: function() {
      var self = this;
      var title;
      if ( self.value && self.value.id ) {
        title = self.api().bestTitle( self.value, self.model.slug );
      } else {
        title = "Add " + self.model.name;
      }
      return title || self.model.name;
    },
    load: function( success ) {
      var self = this;
      var route = self.api().routeFor( "editor-content", {
        model: self.model.slug,
        id: self.value && self.value.id ? self.value.id : null,
        // if we call it "locale" it will get stomped on by the
        // locale in the URL itself.
        "locale-code": (self.locale? self.locale : "")
      });
      $.ajax({ url: route, success: success });
    },
    constructChildren: function() {
      var self = this;
      self.children = [];
      $( self.model.fields ).each( function( index, field ) {
        var editor = self.constructChild(field);
        if (editor) { self.children.push(editor) }

      });
    },
    constructChild: function(field) {
      var self = this;
      if (!self.fieldIsEditable(field)) { return null }

      var fieldEditorClass = fieldEditorMap[ field.type ] || editors.FieldEditor;
      var editor = new fieldEditorClass({
        model: self.model,
        field: field,
        parent: self,
        idField: _( self.model.fields ).find( function(f) { return f.slug === field.slug + "-id" } ),
        value: self.get( field.slug ),
        idValue: self.get( field.slug + "-id" ),
        sync: function( value, next ) { self.syncFromChild( editor, value, next ); }
      });
      return editor;
    },
    syncToDOM: function() {
      $( this.children ).each( function( index, child ) {
        child.syncToDOM();
      });
    },
    syncFromDOM: function() {
      $( this.children ).each( function( index, child ) {
        child.syncFromDOM();
        child.callback("sync");
      });
    },
    syncToChildren: function() {
      var self = this;
      $( this.children ).each( function( index, child ) {
        child.syncValueFrom( self );
      });
    },
    syncFromChild: function( child, value, next ) {
      var self = this;
      if ( self.locale ) {
        var checkboxes = $("input[name='caribou-use-global'][value='" + child.field.slug + "']:checked");
        if (checkboxes.length) {
          value = null;
        }
      }
      if ( value && (child.field.type === "asset"
                    || child.field.type === "part"
                    || child.field.type === "address"
                    || child.field.type === "enum") ) {
        self.set( child.field.slug, value.value );
        self.set( child.field.slug + "-id", value.id );
      } else {
        self.set( child.field.slug, value );
      }

      if (next) next( value );
    },
    attach: function() {
      var self = this;
      $( this.children ).each( function( index, child ) {
        child.attach();
      });

      $( this.selector ).find("select[name=locale]").on("change", function(e) {
        e.preventDefault();
        self.setLocale( $(this).val() );
      }).val( self.locale );

      $( self.children ).each( function(index, child) {
        child.on("caribou:edit", function(e) {
          $("input[name='caribou-use-global'][value='" + child.field.slug + "']").prop("checked", false);
        });
      });
    },
    setLocale: function( v ) {
      var self = this;
      console.log("Setting locale to " + v);
      var oldLocale = self.locale;
      if (oldLocale !== v) {
        self.locale = v;
        self.refresh( function(data) {
          self.value = data.state;
          console.log("Loaded data for locale: " + v);
        } );
      }
    },
    submit: function( next ) {
      var self = this;
      self.syncFromDOM();

      if (preferences.valueForKey("validationLevel") !== "none") {
        // validate the data in this editor and reject the
        // submit if it contains invalid data
        var failures = self.validate();
        if (failures.length) {
          return;
        }
      }

      $( self.children ).each( function(index, child) {
        child.submit();
      });
      editors.Editor.prototype.submit.call( self, next );
    },
    validationFailures: function() {
      var self = this;
      var failures = [];
      $( self.children ).each( function(index, child) {
        var childFailures = child.validationFailures();
        if (childFailures.length) {
          child.indicateValidationFailure(childFailures);
          failures = failures.concat(childFailures);
        }
      });
      return failures;
    },
    validate: function() {
      var self = this;
      var failures = self.validationFailures();
      if (failures.length) {
        console.log("Validation errors:");
        console.log(failures);
        global.caribou.status.render().clearMessages();
      }
      return failures;
    },
  });

  // -------------------------------------------------------
  // BulkModelEditor is a subclass of model editor, and
  // differs from its parent in one very specific way:
  // it provides the ability to edit multiple models
  // of the same type at the same time.  The purpose of
  // this is to allow an admin user to select numerous
  // pieces of content, and then apply a single edit to
  // all of those simultaneously.   One common example
  // of this might be to publish a set of blog posts
  // all at the same time.  Its behaviour is loosely based
  // on the "Edit info" facility in iTunes, which allows
  // the editing of metadata for multiple music tracks
  // at the same time.
  // -------------------------------------------------------
  function BulkModelEditor( options ) {
    ModelEditor.call( this, options );
    this.ids = options.ids;
  }
  $.extend( BulkModelEditor.prototype, ModelEditor.prototype, {
    description: function() {
      var self = this;
      return "Bulk edit: " + self.ids.length + " " + owl.pluralize( self.model.slug );
    },
    load: function( success ) {
      var self = this;
      var route = self.api().routeFor( "bulk-editor-content", {
        model: self.model.slug,
        id: this.ids.join(",")
      });
      $.ajax({ url: route, success: success });
    },
    syncFromChild: function( child, value, next ) {
      var self = this;
      var checkboxes = $("input[name='caribou-update'][value='" + child.field.slug + "']:checked");
      if (checkboxes.length) {
        ModelEditor.prototype.syncFromChild.call( this, child, value, next );
      }
    },
    submit: function( next ) {
      var self = this;
      var old = self.value;
      self.value = {};
      self.syncFromDOM();
      $( self.children ).each( function(index, child) {
        child.submit();
      });
      var values = [];
      _( self.ids ).each(function(id) {
        var n = _.clone( self.value );
        n.id = id;
        values.push(n);
      });
      this.callbackWithValue("submit", values, next);
      //}
    },
    attach: function() {
      var self = this;
      ModelEditor.prototype.attach.call( this );
      $( self.children ).each( function(index, child) {
        child.on("caribou:edit", function(e) {
          $("input[name='caribou-update'][value='" + child.field.slug + "']").prop("checked", true);
        });
      });
    }
  });

  editors.ModelEditor = ModelEditor;
  editors.BulkModelEditor = BulkModelEditor;
})(window);
