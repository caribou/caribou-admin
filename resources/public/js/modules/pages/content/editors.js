(function (global) {
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
          if ( f.type === "integer" && f.slug.match(/(^|_)id$/) ) { return false }
          if ( f.type === "part" ) { return true } // because the part_id is ok
          //if ( f.type === "link" || f.type === "collection" ) { return true }
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

  // Parent class for editors representing fields
  function FieldEditor( options ) {
    var self = this;
    Editor.call( self, options );
    self.field = options.field;
    self.parent = options.parent;
    return self;
  }

  $.extend( FieldEditor.prototype, Editor.prototype, {
    description:   function() { return this.field.slug },
    selector:      function() { return "input[name=" + this.field.slug + "]" },
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
        id: from.get( this.field.slug + "-id" )
      };
    },
    syncsTo: function() {
      return [ this.field.slug, this.field.slug + "-id" ];
    },
    attach: function() {
      var self = this;
      var el = $( self.selector() );
      //if ( el.find('option').length <= 2 ) {
        // hide select because there's only one real option
        //el.hide();
        //el.after( el.find("option:last").text() );
      //} else {
        var link = $('<a href="" class="btn btn-success">Re-sort</a>').click( function(e) {
          e.preventDefault();
          self.sortOptions();
        });
        $( self.selector() ).after( link );
     // }
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
      var target = self.api().model( self.field["target-id"] );
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
        self.stack().push( editor );
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
        self.stack().push( editor );
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
        model: self.api().model( self.field["target-id"] ),
        field: self.field,
        submit: function( value, next ) {
          self.value = value;
          self.callbackWithValue("sync", self.value, next);
        }
      });

      editor.load( function( data, error, jqxhr ) {
        editor.template = data.template;
        editor.value = data.value || editor.value;
        self.stack().push( editor );
      });
    }
  });

  function LinkFieldEditor( options ) { CollectionFieldEditor.call( this, options ) }
  $.extend( LinkFieldEditor.prototype, CollectionFieldEditor.prototype, {});


  //==============================================

  var fieldEditorMap = {
    string:     FieldEditor,
    text:       TextEditor,
    integer:    FieldEditor,
    timestamp:  DateFieldEditor,
    "boolean":  CheckBoxEditor,
    asset:      AssetFieldEditor,
    collection: CollectionFieldEditor,
    part:       PartFieldEditor,
    link:       LinkFieldEditor
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
        editor = new fieldEditorClass({
          model: self.model,
          field: field,
          parent: self,
          idField: _( self.model.fields ).find( function(f) { return f.slug === field.slug + "-id" } ),
          value: self.get( field.slug ),
          idValue: self.get( field.slug + "-id" ),
          sync: function( value, next ) { self.syncFromChild( editor, value, next ); }
        });
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
        id: self.value && self.value.id ? self.value.id : null,
        // if we call it "locale" it will get stomped on by the
        // locale in the URL itself.
        "locale-code": (self.locale? self.locale : "")
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
    syncFromChild: function( child, value, next ) {
      var self = this;
      if ( self.locale ) {
        var checkboxes = $("input[name='caribou-use-global'][value='" + child.field.slug + "']:checked");
        if (checkboxes.length) {
          value = null;
        }
      }
      if ( value && (child.field.type === "asset" || child.field.type === "part") ) {
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
    // too much copy & paste here - refactor this from here
    // and from CollectionChooser
    selected: function() {
      var self = this;
      var selected = [];
      var _content = {};
      _( self.value ).each( function(c) { _content[ c.id ] = c } );
      var ids = $("input[name=id]:checked").each( function(index, el) {
        selected.push(_content[ $(el).val() ]);
      });
      return selected;
    },
    command: function( command ) {
      var self = this;
      var selected = self.selected();
      console.log("Applying command "+command, selected);
      // just do edit for now
      if (command === "edit") {
        if (selected.length === 0) {
          global.caribou.status.addErrorMessage("You have to choose at least one!").render();
        } else if (selected.length === 1) {
          return self.editExisting( selected[0] );
        }
        return self.bulkEdit( selected );
      }
      return;
    },
    bulkEdit: function( values ) {
      var self = this;
      var editor = new BulkModelEditor({
        model: self.model,
        ids: _( values ).pluck("id"),
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, jqxhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push( editor );
      });
    },
    // end of nasty copy/paste.
    addNew: function() {
      var self = this;
      console.log("Adding new %s!", this.model.slug);
      var reciprocalField = self.reciprocalField();

      var value = {};
      if ( self.field.type === "collection" ) {
        value[reciprocalField.slug] = self.instance;
        value[reciprocalField.slug+"-id"] = self.instance.id;
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
        self.stack().push( editor );
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
        self.stack().push( editor );
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
        multiple: true,
        model: self.model,
        current: self.value,
        submit: function( value, next ) {
          console.log("user chose ", value);
          if (!_.isArray(value) ) { value = [value] };
          _(value).each( function(v) {
            if ( self.field.type === "collection" ) {
              v[reciprocalField.slug] = self.instance;
              v[reciprocalField.slug+"-id"] = self.instance.id;
            } else if ( self.field.type === "link" ) {
              v[reciprocalField.slug] = [ self.instance ];
            }
          });
          if (!self.instance.id) {
            self.value.concat( value );
            // complicated situation here if instance.id doesn't exist
            next( value );
          } else {
            self.saveChanges( value, next );
          }
        }
      });
      chooser.load( function(data, error, jqxhr) {
        chooser.template = data.template;
        self.stack().push( chooser );
      });
    },
    saveChanges: function( value, next ) {
      var self = this;
      var data = [];
      if (!_.isArray(value)) { value = [value] }
      _( value ).each( function(v) {
        data.push({ model: self.model.slug, fields: self.prepareForUpdate( v ) });
      });
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
    // can we choose more than one item?
    this.multiple = options.multiple || false;
  }
  $.extend( CollectionChooser.prototype, Editor.prototype, {
    description: function() {
      var self = this;
      return "Choose " + self.model.name;
    },
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
    selected: function() {
      var self = this;
      if (!self.multiple) { return null }
      var selected = [];
      var ids = $("input[name=id]:checked").each( function(index, el) {
        selected.push(self._content[ $(el).val() ]);
      });
      return selected;
    },
    command: function( command ) {
      var self = this;
      var selected = self.selected();
      console.log("Applying command "+command, selected);
      // just do edit for now
      if (command === "edit") {
        if (selected.length === 0) {
          global.caribou.status.addErrorMessage("You have to choose at least one!").render();
        } else if (selected.length === 1) {
          return self.editExisting( selected[0] );
        }
        return self.bulkEdit( selected );
      }
      return;
    },
    // TODO:kd - combine the two following methods
    // or better, make ModelEditor a special case
    // of BulkModelEditor.
    editExisting: function( existing ) {
      var self = this;
      var editor = new ModelEditor({
        model: self.model,
        value: { id: existing.id },
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, jqxhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push( editor );
      });
    },
    bulkEdit: function( values ) {
      var self = this;
      var editor = new BulkModelEditor({
        model: self.model,
        ids: _( values ).pluck("id"),
        submit: function( value, next ) {
          self.saveChanges( value, next );
        }
      });

      editor.load( function(data, error, jqxhr) {
        editor.template = data.template;
        editor.value = data.state;
        editor.syncToChildren();
        self.stack().push( editor );
      });
    },
    saveChanges: function( value, next ) {
      var self = this;
      var data = [];
      if (!_.isArray(value)) { value = [value] }
      _( value ).each( function(v) {
        data.push({ model: self.model.slug, fields: self.prepareForUpdate( v ) });
      });
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
      // TODO:kd - little bit too much going on here now.
      var self = this;
      console.log("collection chooser " + self.model + " attaching");
      //global.caribou.models.enableSorting();
      $( ".edit-link" ).hide();
      $( ".delete-link" ).hide();
      if (self.multiple) {
        $( ".choose-link" ).hide().map(function(index, el) {
          var data = $(this).data();
          if ( self._currentIds[ data.id ] ) {
            $("input[type=checkbox][name=id][value=" + data.id + "]").hide();
          }
        });
      } else {
        $( ".choose-link" ).off("click").filter(function(index) {
          return !self._currentIds[ $(this).data().id ];
        }).on("click", function(e) {
          e.preventDefault();
          var id = $(this).data().id;
          self.value = self._content[ id ];
          $("#back-button").trigger("click");
        }).show();
      }
      $(".pagination a").off("click").on("click", function(e) {
        e.preventDefault();
        self.page = $(this).data().page;
        self.refresh( function( data, error, jqxhr ) {
          console.log("refreshed to page " + self.page);
        });
      });
    },
    submit: function( next ) {
      var self = this;
      if (self.multiple) {
        self.value = self.selected();
      }
      self.callback("submit", next);
    }
  });

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

  //
  //=====================================================

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
            page: "create-model-instance",
            slug: self.activeEditor().model.slug
          });
        });
      });
      self.saveAndContinue().click( function(e) {
        e.preventDefault();
        return self.submitActiveEditor( function( value ) {
          location.href = global.caribou.api.routeFor("to-route", {
            page: "edit-model-instance",
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
      return new ModelEditor( options );
    }
  });

  (function ($) {
    $.fn.editorStack = function( options ) {
      var selector = this.selector;
      var opts = $.extend( options, { selector: selector } );
      var stack = new EditorStack( opts );
      this.data({ stack: stack });
      stack.attach();
      return stack;
    }
  })(jQuery);

  // export the classes through the global
  global.caribou = global.caribou || {};
  global.caribou.editors = {
    registry: new EditorRegistry(),
    Editor: Editor,
    FieldEditor: FieldEditor,
    ModelEditor: ModelEditor,
    BulkModelEditor: BulkModelEditor,
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
  var ids = pageInfo.instanceIds || [];
  var api = window.caribou.api;
  var stack = $("#editor").editorStack();

  var editor;
  var options = {
    model: api.model( pageInfo.model ),
    locale: (pageInfo.locale === "global" ? null : pageInfo.locale),
    submit: function( value, next ) {
      console.log("Holy smokes, batman!", value);
      var values = _.isArray( value ) ? value : [value];
      var opts = {};
      if (editor.locale && editor.locale !== "") {
        opts.locale = editor.locale;
      }
      var data = _.map( values, function(v) {
        return { model: pageInfo.model, fields: editor.prepareForUpdate( v ), opts: opts };
      });
      api.post( data, function( d ) {
        console.log(d);
        if (next) {
          next( d.length > 1 ? d : d[0] );
        } else {
          location.href = api.routeFor( "to-route", { page: "admin.results", slug: pageInfo.model } );
        }
      });
    }
  };
  // ack ack
  if ( pageInfo.instanceIds.length > 1 ) {
    options.ids = pageInfo.instanceIds;
  } else {
    options.value = { id: pageInfo.instanceIds[0] };
  }

  editor = pageInfo.instanceIds.length > 1 ?
             new window.caribou.editors.BulkModelEditor(options)
           : window.caribou.editors.registry.editor(options);
  editor.load( function( data, error, xhr ) {
    editor.value = pageInfo.instanceIds.length? data.state : {};
    editor.syncToChildren();
    editor.template = data.template;
    stack.push(editor);
  });
});
