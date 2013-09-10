//-------------------------------------------------------
// editors/part.js
// "Part" fields are commonly known as "to-one" or
// "has-one" relationships.  The PartFieldEditor
// class provides the generic functionality for
// editing a single related piece of content.  It is
// further customised by AssetFieldEditorm, amongst
// others.
//-------------------------------------------------------

(function (global) {
  global.caribou = global.caribou || {};

  var editors = global.caribou.editors;
  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function PartFieldEditor( options ) { editors.EnumFieldEditor.call( this, options ); }
  $.extend( PartFieldEditor.prototype, editors.EnumFieldEditor.prototype, {
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

      var editor = new editors.ModelEditor({
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

  editors.PartFieldEditor = PartFieldEditor;
})(window);
