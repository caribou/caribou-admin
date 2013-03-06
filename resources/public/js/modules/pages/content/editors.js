var editors = (function (global) {

  function Editor( options ) {
    var self = this;

    if ( options.from ) {
      self.initFrom( options.from );
    }
    self.model = options.model || self.model;
    self.value = options.value || self.value;

    // stash all options here
    self.options = options;
    return self;
  }

  $.extend( Editor.prototype, {
    api: function() { return global.caribou.api },

    initFrom: function( parent ) {
      var self = this;
      self.parent = parent;
      self.model = parent.model;
      self.value = parent.value;
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
          if ( f.type === "integer" && f.slug.match(/_id$/) ) { return false }
          //if ( f.type === "link" || f.type === "collection" ) { return true }
          return !f.editable;
        }).map( function(f) { return f.slug }).value();
      return _( data ).omit( blacklist );
    },
    description: function() { return this.model.slug },
    attach:      function() {},
    syncToDOM:   function() {},
    syncFromDOM: function() {},
    load:        function() {},
    refresh:     function( success ) {
      var self = this;
      self.load( function( data, error, jqxhr ) {
        self.template = data.template;
        $( self.selector ).html( self.template );
        self.attach();
        if (success) { success( data ) }
      });
    }
  });

  // Parent class for editors representing fields
  function FieldEditor( options ) {
    var self = this;
    Editor.call( self, options );
    self.field = options.field;
    self.parent = options.parent;
    return self;
  }

  $.extend( FieldEditor.prototype, Editor.prototype, {
    description: function() { return this.field.slug },
    selector: function() { return "input[name=" + this.field.slug + "]" },
    syncToDOM: function () { $( this.selector() ).val( this.value ) },
    syncFromDOM: function () { this.value = $( this.selector() ).val() },
    syncValueFrom: function( from ) { this.value = from.get( this.field.slug ) }
  });

  function TextEditor( options ) { FieldEditor.call( this, options ) }
  $.extend( TextEditor.prototype, FieldEditor.prototype, {
    selector: function() { return "textarea[name=" + this.field.slug + "]" }
  });

  function CheckBoxEditor( options ) { return FieldEditor.call( this, options ); }
  $.extend( CheckBoxEditor.prototype, FieldEditor.prototype, {
    syncToDOM: function() { $( this.selector() ).prop( "checked", this.value ) },
    syncFromDOM: function() { this.value = $( this.selector() ).prop( "checked" ) }
  });

  function DateFieldEditor( options ) { FieldEditor.call( this, options ) }
  $.extend( DateFieldEditor.prototype, FieldEditor.prototype, {
    attach: function() {
      FieldEditor.prototype.attach.call(this);
      $( this.selector() ).parent().datepicker({
        format: "yyyy-mm-dd",
        viewMode: "years"
      });
    }
  });

  function PartFieldEditor( options ) {
    FieldEditor.call( this, options );
    this.idField = options.idField;
    this.value = {
      id: options.idValue,
      value: options.value
    };
    console.log("Set PartFieldEditor's value:", this.value);
  }
  $.extend( PartFieldEditor.prototype, FieldEditor.prototype, {
    selector: function() { return "select[name=" + this.field.slug + "]" },
    syncToDOM: function() {
      var id = this.value.id || ( this.value.value ? this.value.value.id : null );
      $( this.selector() ).val( id );
    },
    syncFromDOM: function() {
      var previous = this.value.id;
      this.value.id = $( this.selector() ).val()
      if ( previous && previous != this.value.id ) {
        this.value.value = null;
      }
    },
    syncValueFrom: function( from ) {
      this.value = {
        value: from.get( this.field.slug ),
        id: from.get( this.field.slug + "_id" )
      };
    },
    attach: function() {
      var self = this;
      var el = $( self.selector() );
      if ( el.find('option').length <= 2 ) {
        // hide select because there's only one real option
        el.hide();
        el.after( el.find("option:last").text() );
      } else {
        var link = $('<a href="" class="btn btn-success">Re-sort</a>').click( function(e) {
          e.preventDefault();
          self.sortOptions();
        });
        $( self.selector() ).after( link );
      }
      $("#add-" + self.model.slug + "-" + self.field.slug).click(function(e) {
        e.preventDefault();
        return self.addNew();
      });
    },
    sortOptions: function() {
      var self = this;
      $( self.selector() ).sortOptionList();
    },
    addNew: function() {
      var self = this;
      var target = self.api().model( self.field.target_id );
      var value = {};

      var editor = new ModelEditor({
        model: target,
        value: value,
        // TODO: all these callbacks should just be methods
        submit: function( value, next ) {
          var data = [{ model: target.slug, fields: self.prepareForUpdate( value ) }];
          self.api().post( data, function( d ) {
            console.log(d);
            self.parent.load( function( data, error, jqxhr ) {
              self.parent.template = data.template;
              global.caribou.status.addSuccessMessage(
                "Added new " + target.slug + ": " +
                global.caribou.api.bestTitle( value, target.slug )
              );
              self.value = {
                value: d[0],
                id: d[0].id
              };
              if (next) { next( value ) }
            });
          });
        }
      });

      editor.load( function(data, error, xhr) {
        editor.template = data.template;
        global.caribou.editors.push( editor );
      });
    }
  });

  function AssetFieldEditor( options ) { PartFieldEditor.call( this, options ); }
  $.extend( AssetFieldEditor.prototype, PartFieldEditor.prototype, {
    syncToDOM: function() {
      var asset = this.value.value;
      if ( asset ) {
        $("img#" + this.field.slug).attr({ src: "/" + asset.path });
      }
    },
    syncFromDOM: function() {},
    attach: function() {
      var self = this;
      $("#" + self.model.slug + "-" + self.field.slug).find("a").click( function(e) {
        e.preventDefault();
        console.log(self, "Upload/choose an image");
        return self.uploadOrChoose();
      });
    },
    uploadOrChoose: function() {
      var self = this;

      var editor = new AssetEditor({
        from: self,
        field: self.field,
        model: self.api().model("asset"),
        submit: function( value, next ) {
          self.value.value = value;
          self.value.id = (value? value.id : null);
          self.callbackWithValue("sync", self.value, next);
        }
      });

      editor.load( function( data, error, jqxhr ) {
        editor.template = data.template;
        editor.value = data.state || editor.value;
        global.caribou.editors.push( editor );
      });

      return false;
    }
  });

  function CollectionFieldEditor( options) { FieldEditor.call( this, options ) }
  $.extend( CollectionFieldEditor.prototype, FieldEditor.prototype, {
    selector: function() { return "span#" + this.field.slug },
    syncToDOM: function() { $( this.selector() ).html( this.value ? this.value.length : "No" ) },
    syncFromDOM: function() {},
    attach: function() {
      var self = this;
      var editButton = $("#edit-" + self.model.slug + "-" + self.field.slug);
      if ( self.parent.value && self.parent.value.id ) {
        editButton.show();
        editButton.click(function(e) {
          e.preventDefault();
          return self.edit();
        });
      } else {
        editButton.hide();
        editButton.before("You can edit this after you've saved your work.");
      }
    },
    edit: function() {
      var self = this;
      console.log("edit " + self.field.type + "...");
      var editor = new CollectionEditor({
        from: self,
        instance: self.parent.value,
        instanceModel: self.model,
        model: self.api().model( self.field.target_id ),
        field: self.field,
        submit: function( value, next ) {
          self.value = value;
          self.callbackWithValue("sync", self.value, next);
        }
      });

      editor.load( function( data, error, jqxhr ) {
        editor.template = data.template;
        editor.value = data.value || editor.value;
        global.caribou.editors.push( editor );
      });
    }
  });

  function LinkFieldEditor( options ) { CollectionFieldEditor.call( this, options ) }
  $.extend( LinkFieldEditor.prototype, CollectionFieldEditor.prototype, {});


  //==============================================

  var fieldEditorMap = {
    string: FieldEditor,
    text: TextEditor,
    integer: FieldEditor,
    timestamp: DateFieldEditor,
    "boolean": CheckBoxEditor,
    asset: AssetFieldEditor,
    collection: CollectionFieldEditor,
    part: PartFieldEditor,
    link: LinkFieldEditor
    // etc.
  };

  // plain editor for plain form
  function ModelEditor( options ) {
    var self = this;
    Editor.call( this, options );
    self.children = [];
    $( self.model.fields ).each( function( index, field ) {
      if ( field.editable ) {
        var fieldEditorClass = fieldEditorMap[ field.type ] || FieldEditor;
        var editor;
        // I hate this here.  It would be better to do this with polymorphism
        // but the tricky thing is the "sync" function needs to be a closure, and it
        // varies from field to field.
        switch (field.type) {
          case "part":
          case "asset":
            editor = new fieldEditorClass({
              model: self.model,
              field: field,
              parent: self,
              idField: _( self.model.fields ).find( function(f) { return f.slug === field.slug + "_id" } ),
              value: self.get( field.slug ),
              idValue: self.get( field.slug + "_id" ),
              sync: function( value, next ) {
                self.set( field.slug, value.value );
                self.set( field.slug + "_id", value.id );
                if (next) next( value );
              }
            });
            break;
          default:
            editor = new fieldEditorClass({
              model: self.model,
              field: field,
              parent: self,
              value: self.get( field.slug ),
              sync: function( value, next ) { self.set( field.slug, value ); if (next) next(value); }
            });
        }
        self.children.push( editor );
      }
    });
  }

  $.extend( ModelEditor.prototype, Editor.prototype, {
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
        id: self.value && self.value.id ? self.value.id : null
      });
      $.ajax({ url: route, success: success });
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
    attach: function() {
      $( this.children ).each( function( index, child ) {
        child.attach();
      });
    },
    submit: function( next ) {
      var self = this;
      self.syncFromDOM();
      $( self.children ).each( function(index, child) {
        child.submit();
      });
      Editor.prototype.submit.call( self, next );
    }
  });


  function AssetEditor( options ) {
    Editor.call( this, options );
    this.field = options.field;
    this._assetsById = {};
  }
  $.extend( AssetEditor.prototype, Editor.prototype, {
    description: function() { return this.field.slug },
    attach: function() {
      var self = this;
      $("#upload-asset").ajaxfileupload({
        action: self.api().routeFor("upload-asset"),
        onComplete: function(response) {
          self.value = response.state;
          $("#current-image").attr("src", "/" + self.value.path);
          self.load(function( data, error, jqxhr ) {
            self.refreshAssets();
          });
        }
      });
      $("#upload-button").click( function(e) {
        e.preventDefault();
        self.upload(e);
      });
      $("#asset-search-button").click( function(e) {
        e.preventDefault();
        self.refreshAssets();
      })
      self.refreshAssets();
    },
    load: function( success ) {
      var self = this;
      var route = self.api().routeFor( "editor-content", {
        id: self.get("id", ""),
        model: "asset",
        template: "_asset.html"
      });
      $.ajax({ url: route, success: success });
    },
    loadAssets: function(assets) {
      var self = this;
      self._assetsById = self._assetsById || {};
      _( assets ).each( function(a) { self._assetsById[a.id] = a } );
    },
    refreshAssets: function(page) {
      var self = this;
      $.ajax({
        url: self.api().routeFor( "editor-content",
          { model: "asset", template: "_existing_assets.html", page: (page || "0"), size: 50 }
        ),
        type: "GET",
        success: function( data, error, jqxhr ) {
          self.loadAssets(data.state);
          $("#assets").html( data.template );
          $("#assets").find("select[name=images]").imagepicker({ show_label: false });
          $("#assets a").click( function(e) {
            e.preventDefault();
            self.refreshAssets($(this).data().page);
          });
        }
      });
    },
    syncFromDOM: function() {
      console.log("AssetEditor syncing from DOM");
      var assetId = $("select[name=images]").val();
      if ( assetId ) {
        this.value = asset = this._assetsById[ assetId ];
      }
      console.log( this.value );
    }
  });

  function CollectionEditor( options ) {
    Editor.call( this, options );
    this.field = options.field;
    this.instance = options.instance;
    this.instanceModel = options.instanceModel;
    this.page = 0;
  }
  $.extend( CollectionEditor.prototype, Editor.prototype, {
    reciprocalField: function() {
      var self = this;
      if (self._reciprocalField) { return self._reciprocalField }
      var reciprocalField = _( self.model.fields ).find( function(field) {
        return field.id === self.field.link_id;
      });
      return self._reciprocalField = reciprocalField;
    },
    load: function( success, data ) {
      var self = this;
      var route = self.api().routeFor( "editor-associated-content", {
        model: self.instanceModel.slug,
        id: self.instance.id,
        template: "_paged_collection.html",
        page: self.page,
        field: self.field.slug
      });
      var method = "GET";
      if (data) { method = "POST" }
      $.ajax({ url: route, type: method, data: data, success: success });
    },
    addNew: function() {
      var self = this;
      console.log("Adding new %s!", this.model.slug);
      var reciprocalField = self.reciprocalField();

      var value = {};
      if ( self.field.type === "collection" ) {
        value[reciprocalField.slug] = self.instance;
        value[reciprocalField.slug+"_id"] = self.instance.id;
      } else if ( self.field.type === "link" ) {
        value[reciprocalField.slug] = [ self.instance ];
      }

      var editor = new ModelEditor({
        model: self.model,
        value: value,
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, xhr) {
        editor.template = data.template;
        global.caribou.editors.push( editor );
      });

      return false;
    },
    editExisting: function( existing ) {
      var self = this;
      var editor = new ModelEditor({
        model: self.model,
        value: { id: existing.id },
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, xhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        global.caribou.editors.push( editor );
      });
    },
    removeExisting: function( existing ) {
      var self = this;
      var removed = _( self.value ).find(function(c) { return c.id === existing.id });
      if (removed) {
        console.log("Removing:", removed);

        global.caribou.models.post("remove-link", {
          model: self.parent.model.slug,
          field: self.field.slug,
          id: self.instance.id,
          "target-id": removed.id
        }, function(data) {
          self.refresh(function(data) {
            console.log(data);
            self.value = data.state;
          });
        });

      } else {
        console.log("Couldn't find " + existing.id);
      }
    },
    chooseExisting: function() {
      console.log("Choose existing");
      var self = this;
      var reciprocalField = self.reciprocalField();
      var chooser = new CollectionChooser({
        model: self.model,
        current: self.value,
        submit: function( value, next ) {
          console.log("user chose ", value);
          if ( self.field.type === "collection" ) {
            value[reciprocalField.slug] = self.instance;
            value[reciprocalField.slug+"_id"] = self.instance.id;
          } else if ( self.field.type === "link" ) {
            value[reciprocalField.slug] = [ self.instance ];
          }
          if (!self.instance.id) {
            self.value.push( value );
            // complicated situation here if instance.id doesn't exist
            next( value );
          } else {
            self.saveChanges( value, next );
          }
        }
      });
      chooser.load( function(data, error, jqxhr) {
        chooser.template = data.template;
        global.caribou.editors.push( chooser );
      });
    },
    saveChanges: function( value, next ) {
      var self = this;
      var data = [{ model: self.model.slug, fields: self.prepareForUpdate( value ) }];
      self.api().post( data, function( d ) {
        console.log(d);
        self.load( function(data, error, jqxhr ) {
          self.value = data.state;
          self.template = data.template;
          global.caribou.status.addSuccessMessage(
            "Saved changes to " + self.model.slug + ": " +
            global.caribou.api.bestTitle( value, self.model.slug )
          );
          if (next) { next( value ) }
        });
      });
    },
    attach: function() {
      var self = this;
      console.log("collection editor " + self.field.slug + " attaching");
      global.caribou.models.enableSorting();
      $( ".edit-link" ).click(function(e) {
        e.preventDefault();
        self.editExisting( $(this).data() );
      });
      $( ".delete-link" ).off("click").on("click", function(e) {
        e.preventDefault();
        global.caribou.models.showDeleteDialog(this, function(data) {
          self.refresh( function( data ) {
            self.value = data.state;
            self.syncToDOM();
          });
        });
      });
      if ( self.field.type === "link" ) {
        $( ".remove-link" ).off("click").on("click", function(e) {
          e.preventDefault();
          self.removeExisting( $(this).data() );
        }).show();
      }
      $(".pagination a").off("click").on("click", function(e) {
        e.preventDefault();
        self.page = $(this).data().page;
        self.refresh( function( data, error, jqxhr ) {
          console.log("refreshed to page " + self.page);
        });
      });
    }
  });

  function CollectionChooser( options ) {
    Editor.call( this, options );
    // used for pagination
    this.page = 0;
    // the current state of this collection,
    // so we can highlight/identify which are already
    // present and which can be added
    this.current = options.current || [];
    var _currentIds = {};
    _( this.current ).each(function( c ) { _currentIds[ c.id ] = true });
    this._currentIds = _currentIds;
  }
  $.extend( CollectionChooser.prototype, Editor.prototype, {
    load: function( success ) {
      var self = this;
      var route = self.api().routeFor( "editor-content", {
        model: self.model.slug,
        template: "_paged_collection.html",
        page: self.page
      });
      $.ajax({ url: route, success: function( data, error, jqxhr ) {
        self.loadContent( data.state );
        success( data, error, jqxhr );
      }});
    },
    loadContent: function( content ) {
      var self = this;
      self._content = {};
      _( content ).each( function(c) { self._content[ c.id ] = c } );
    },
    attach: function() {
      var self = this;
      console.log("collection chooser " + self.model + " attaching");
      //global.caribou.models.enableSorting();
      $( ".edit-link" ).hide();
      $( ".delete-link" ).hide();
      $( ".choose-link" ).off("click").filter(function(index) {
        return !self._currentIds[ $(this).data().id ];
      }).on("click", function(e) {
        e.preventDefault();
        var id = $(this).data().id;
        self.value = self._content[ id ];
        $("#back-button").trigger("click");
      }).show();
      $(".pagination a").off("click").on("click", function(e) {
        e.preventDefault();
        self.page = $(this).data().page;
        self.refresh( function( data, error, jqxhr ) {
          console.log("refreshed to page " + self.page);
        });
      });
    }
  });

  //
  //=====================================================

  function EditorStack( options ) {
    var self = this;
    self.options = options;
    self.editors = [];
  }

  $.extend( EditorStack.prototype, {
    // These controls should be added by editors, not
    // hardcoded here.
    saveChangesButton: function() { return $("#save-changes"); },
    saveAndNew:        function() { return $("#save-and-new"); },
    saveAndContinue:   function() { return $("#save-and-continue"); },
    backButton:        function() { return $("#back-button");  },
    cancelButton:      function() { return $("#cancel-button"); },
    addNewButton:      function() { return $("#add-new"); },
    chooseExistingButton: function() { return $("#choose-existing"); },
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
            page: "create_model_instance",
            slug: self.activeEditor().model.slug
          });
        });
      });
      self.saveAndContinue().click( function(e) {
        e.preventDefault();
        return self.submitActiveEditor( function( value ) {
          location.href = global.caribou.api.routeFor("to-route", {
            page: "edit_model_instance",
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
      return self;
    },
    activeEditor: function() { return this.editors[ this.editors.length - 1 ] },
    push: function( editor ) {
      var active = this.activeEditor();
      if ( active ) {
        active.syncFromDOM();
      }
      this.editors.push( editor );
      global.caribou.breadcrumbs.push({ text: editor.description() });
      this.render();
    },
    pop: function( editor ) {
      var editor = this.editors.pop();
      if ( editor ) {
        global.caribou.breadcrumbs.pop();
        this.render();
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
        if ( !active.value.id ) {
          this.saveChangesButton().text("Create");
        }
        this.saveChangesButton().show();
        this.saveAndNew().show();
        this.saveAndContinue().show();
        this.backButton().hide();
        this.cancelButton().hide();
      }
      active.render( this.options.selector );
      active.attach();
      // TODO:kd - not sure how to check if it has an addNew method
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
    }
  });

  return {
    Editor: Editor,
    FieldEditor: FieldEditor,
    ModelEditor: ModelEditor,
    EditorStack: EditorStack
  };
})(window);

_.templateSettings = {
  interpolate : /\{\{(.+?)\}\}/g
};

$(function () {
  // this seems janky; the way of retrieving the data for the page
  // should live somewhere else rather than this hardcoded jQuery stuff.
  if ( !$("#editor")[0] ) { return }

  var pageInfo = $('body').data();
  var api = window.caribou.api;
  var stack = window.caribou.editors = new editors.EditorStack({ selector: "#editor" });
  stack.attach();

  var editor = new editors.ModelEditor({
    model: api.model( pageInfo.model ),
    value: { id: pageInfo.instanceId },
    submit: function( value, next ) {
      console.log("Holy smokes, batman!", value);
      var data = [{ model: pageInfo.model, fields: editor.prepareForUpdate( value ) }];
      api.post( data, function( d ) {
        console.log(d);
        if (next) { 
          next( d[0] );
        } else {
          location.href = api.routeFor( "to-route", { page: "results", slug: pageInfo.model } );
        }
      });
    }
  });

  editor.load( function( data, error, xhr ) {
    editor.value = pageInfo.instanceId? data.state : {};
    editor.syncToChildren();
    editor.template = data.template;
    stack.push(editor);
  });
});
