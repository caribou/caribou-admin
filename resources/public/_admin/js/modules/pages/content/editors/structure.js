(function (global) {
  global.caribou = global.caribou || {};
  var editors = global.caribou.editors;

  if (!editors) {
    throw "editors/base.js and editors/fields.js have not been included";
  }

  function StructureFieldEditor(options) {
    var self = this;

    editors.FieldEditor.call(self, options);
    self._schema = options.schema;
  }

  $.extend( StructureFieldEditor.prototype, editors.FieldEditor.prototype, {
  });

  global.caribou.editors.StructureFieldEditor = StructureFieldEditor;
})(window);

