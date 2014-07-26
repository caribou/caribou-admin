/**********************************************************
 * editors.js
 *********************************************************/

_.templateSettings = {
  interpolate : /\{\{(.+?)\}\}/g
};

$(function () {
  // this seems janky; the way of retrieving the data for the page
  // should live somewhere else rather than this hardcoded jQuery stuff.
  if ( !$("#editor")[0] ) { return; }

  var pageInfo = $('body').data();
  var ids = pageInfo.instanceIds || [];
  var api = window.caribou.api;
  var stack = $("#editor").editorStack();

  var editor;
  var options = {
    model: api.model( pageInfo.model ),
    locale: (pageInfo.locale === "global" ? null : pageInfo.locale),
    submit: function( value, next ) {
      console.log(value);
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
          //window.history.back();
          location.href = api.routeFor( "to-route",
                                        { page: "admin.results",
                                          slug: pageInfo.model } );
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
