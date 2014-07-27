//-------------------------------------------------------
// editors/fields.js
// This is where the specific individual field editors
// are defined, one for each type of caribou field
// that can exist on a model.  When a generic model
// editor starts up, it builds an array of child field
// editors, one for each of its fields.
//-------------------------------------------------------

(function (global) {

  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js has not been included";
  }

  function TextEditor( options ) { editors.FieldEditor.call( this, options ); }
  $.extend( TextEditor.prototype, editors.FieldEditor.prototype, {
    selector: function() { return "textarea[name=" + this.field.slug + "]"; }
  });

  function CheckBoxEditor( options ) {
    return editors.FieldEditor.call( this, options );
  }
  $.extend( CheckBoxEditor.prototype, editors.FieldEditor.prototype, {
    syncToDOM: function() {
      $( this.selector() ).prop( "checked", this.value );
    },
    syncFromDOM: function() {
      this.value = $( this.selector() ).prop( "checked" );
    }
  });

  function DateFieldEditor( options ) {
    editors.FieldEditor.call( this, options );
  }
  $.extend( DateFieldEditor.prototype, editors.FieldEditor.prototype, {
    attach: function() {
      editors.FieldEditor.prototype.attach.call(this);

      if ( !this.field.format ||
           this.field.format === "date" ||
           this.field.format === "datetime" ) {
             $( this.parent.selector +
                " input[name=" +
                this.field.slug +
                "-date]" ).parent().show().datepicker({
                  format: "yyyy-mm-dd",
                  viewMode: "years"
                });
           }
      if ( !this.field.format ||
           this.field.format === "time" ||
           this.field.format === "datetime" ) {
             $( this.parent.selector +
                " input[name=" +
                this.field.slug +
                "-time]" ).show().timepicker({
                  //show24Hours: false,
                  timeFormat: 'H:i',
                  step: 15
                });
           }
    },
    syncToDOM: function() {
    },
    syncFromDOM: function() {
      var dateString = "1900-01-01";
      var format = this.field.format || "datetime";
      var base_select = this.parent.selector + " input[name=" + this.field.slug;
      var selector;
      if ( format.match(/date/) ) {
        selector = base_select + "-date]";
        dateString = $( selector ) .val();
      }
      var timeString = "00:00";
      if ( format.match(/time/) ) {
        selector =  base_select + "-time]";
        timeString = $( selector ).val();
      }
      console.log("date string is %s and time string is %s",
                  dateString,
                  timeString);
      this.value = dateString + "T" + timeString + ":00Z";
    }
  });

  function PasswordFieldEditor( options ) {
    editors.FieldEditor.call( this, options );
  }
  $.extend( PasswordFieldEditor.prototype, editors.FieldEditor.prototype, {
    syncToDOM: function() {},
    syncFromDOM: function() {
      if ( $(this.selector()).data().dirty) {
        this.value = $( this.selector() ).val();
      } else {
        this.value = null;
      }
    },
    attach: function() {
      var self = this;
      editors.FieldEditor.prototype.attach.call(self);
      self.on("caribou:edit", function(e) {
        $(self.selector()).data().dirty = true;
      });
    }
  });

  function EnumFieldEditor( options ) {
    editors.FieldEditor.call(this, options);
    this.idField = options.idField;
    this.value = {
      id: options.idValue,
      value: options.value
    };
    console.log("Set EnumFieldEditor's value:", this.value);
  }
  $.extend( EnumFieldEditor.prototype, editors.FieldEditor.prototype, {
    selector: function() {return "select[name=" + this.field.slug + "]"; },
    syncToDOM: function() {
      var current = $( this.selector() ).val();
      if (!current) {
        var id = this.get("id") || this.get("value.id") || null;
        $( this.selector() ).val( id );
      }
    },
    syncFromDOM: function() {
      var previous = this.get("id");
      this.value.id = $( this.selector() ).val();
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
    }
  });

  // export these editors
  editors.TextEditor = TextEditor;
  editors.CheckBoxEditor = CheckBoxEditor;
  editors.DateFieldEditor = DateFieldEditor;
  editors.PasswordFieldEditor = PasswordFieldEditor;
  editors.EnumFieldEditor = EnumFieldEditor;
})(window);
