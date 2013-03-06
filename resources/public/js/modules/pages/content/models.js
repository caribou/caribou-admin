( function(global) {
  function models() {
    var validateName = function(name) {
      console.log('Checking name ' + name);
      // if name is invalid, disable form submission
      // tbd.
    };

    // enable sortable elements
    var enableSorting = function( opts ) {
      opts = opts || {};
      var selector = opts.selector || ".sortable";

      $(selector).sortable({
        items: "tr:not(.ui-state-disabled)",
        cancel: ".ui-state-disabled",
        stop: function(e, ui) {
          ui.item.children('td').effect('highlight', {}, 1000);
          $(this).popover('show');
          // TODO:kd - disable other controls?
        }
      }).popover({
        html: true,
        animation: true,
        title: "You've changed the order!",
        // TODO: grab this from the DOM instead of hardcoding
        content: "You need to click to save your new order. <br />" + 
                 "<button class='btn btn-warning' " +
                 "onclick='window.caribou.models.updateOrdering();'>SAVE</button>",
        trigger: "manual"
      });
    };

    var _post = function( action, data, success, failure ) {
      success = success || function( data ) {
        location.reload(); // what's the kosher way to do this again?
      };
      failure = failure || function(e) { console.error(e) };

      // submit items
      $.ajax({
        url: global.caribou.api.routeFor( action ),
        type: "POST",
        //dataType: "json",
        contentType: "application/json; charset=utf-8",
        data: JSON.stringify({ data: data }),
        success: success,
        failure: failure
      });
    }

    var updateOrdering = function() {
      var items = [];
      var selector = $( ".sortable" ).sortable( "option", "items" );
      var parentData = $(".sortable").data("position");
      $(".sortable").find(selector).each( function( index, item ) {
        // only care about items whose position has changed, items whose original position was 0
        // or ... what else?
        var data = $(item).data("position") || {};
        console.log( "Initial is " + data.position + " and index is " + index );
        if ( data.position !== ( index + parentData.offset ) ) {
          var fields = { id: data.id };
          fields[ parentData.field ] = index + parentData.offset;
          items.push( { model: parentData.model, fields: fields } );
        }
      });
      console.log(items);
      // submit items
      _post( "update-all", items );
    }

    var showDeleteDialog = function( el, callback ) {
      var data = [ { model: $(el).data().model || "field", id: $(el).data().id + '' } ];
      $('#delete').find('#delete-submit').click( function( e ) {
        e.preventDefault();
        _post( "delete-all", data, function() {
          $('#delete').modal('hide');
          if (callback) {
            callback( data );
          } else {
            location.reload();
          } 
        });
        return false;
      });

      $('#delete').modal('show');
      return false;
    }

    var showAddFieldDialog = function( el ) {
      var data = $( el ).data();
      $("#new-field").modal();
      $("#new-field select[name='field-type']").change(function( e ) {
        var v = $( this ).val();
        if ( v === "collection" || v === "part" || v === "link" ) {
          $("#new-field #association-controls").show();
          if ( v === "part" ) {
            $("#new-field #reciprocal-name").val( owl.pluralize( data.model ) );
          } else {
            $("#new-field #reciprocal-name").val( data.model );
          }
        } else {
          $("#new-field #association-controls").hide();
        }
      });
    }

    var enableDeleteLinks = function( opts ) {
      $(".delete-link").on("click", function(e) {
        e.preventDefault();
        showDeleteDialog( this );
      });
    };

    // enable any sorting on the page initially
    enableSorting();
    enableDeleteLinks();

    return {
      validateName: validateName,
      updateOrdering: updateOrdering,
      showDeleteDialog: showDeleteDialog,
      showAddFieldDialog: showAddFieldDialog,
      enableDeleteLinks: enableDeleteLinks,
      post: _post,
      enableSorting: enableSorting
    };
  }

  global.caribou = global.caribou || {};
  global.caribou.models = models();

})( window );
