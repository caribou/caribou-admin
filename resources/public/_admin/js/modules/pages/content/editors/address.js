(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function AddressFieldEditor( options ) { editors.PartFieldEditor.call( this, options ) }
  $.extend( AddressFieldEditor.prototype, editors.PartFieldEditor.prototype, {
    selector: function() { return "span#" + this.field.slug },
    syncToDOM: function() {
      var address = this.value.value;
      if ( address ) {
        $( this.selector() ).prepend( "<pre style='float:left'>" + global.caribou.models.formatAddress( address ) + "</pre>" );
        $( this.selector() ).prepend( "<img style='float:left' src='" + global.caribou.models.mapImageURL( address, 150, 100) + "' />" );
      }
    },
    syncFromDOM: function() {},
    attach: function() {
      var self = this;
      $( this.selector() ).find("a").click( function(e) {
        e.preventDefault();
        console.log("Set/edit address");
        return self.createOrEditAddress();
      });
    },
    createOrEditAddress: function() {
      var self = this;
      var target = self.api().model("location");
      var value = self.get("value") || {};
      var editor = new editors.ModelEditor({
        model: target,
        value: value,
        submit: function( value, next ) {
          var data = [{ model: target.slug, fields: self.prepareForUpdate( value ) }];
          self.api().post( data, function( d ) {
            console.log(d);
            self.value.value = d[0];
            self.value.id = (d[0]? d[0].id : null);
            self.callbackWithValue("sync", self.value, next);
          });
        }
      });

      editor.load( function(data, error, xhr) {
        editor.template = data.template;
        self.stack().push( editor );
      });
    }
  });

  editors.AddressFieldEditor = AddressFieldEditor;
})(window);
