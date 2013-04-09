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
      var rowNumber = $(".sortable tr").length;

    // Return a helper with preserved width of cells
   if (rowNumber > 1) {
      $(selector).sortable({
        start: function(e, ui){
          ui.placeholder.html('<td colspan="10">&nbsp;</td>');
        },
        placeholder: "ui-sortable-placeholder",
        forcePlaceholderSize: true,
        helper: function(e, ui) {
          ui.children().each(function() {
            $(this).width($(this).width());
          });
          return ui;
        },
        items: "tr:not(.ui-state-disabled)",
        cancel: ".ui-state-disabled",
        update: function(e, ui) {
          $('.changeOrderMessage').show();
          // TODO:kd - disable other controls?
        },
        stop: function(e, ui) {
          ui.item.addClass('ui-sortable-highlight');
          setTimeout(function() {
            ui.item.removeClass('ui-sortable-highlight');
          },500);
        }
      });
    } else {
        $(selector).sortable({ disabled: true });
        $(selector).removeClass('sortable');
      }
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
      var selector = $( ".sortable" ).sortable( "option", "items" );
      var parentData = $(".sortable").data("position");
      var items = [];
      var payload = { model: parentData.model,
                      association: parentData.association,
                      id: parentData.umbrella
                    };

      $(".sortable").find(selector).each( function( index, item ) {
        // only care about items whose position has changed, items whose original position was 0
        // or ... what else?
        var data = $(item).data("position") || {};
        console.log( "Initial is " + data.position + " and index is " + index );
        if ( data.position !== ( index + parentData.offset + 1 ) ) {
          //var fields = { id: data.id };
          //fields[ parentData.field ] = index + parentData.offset;
          // we add one because position is one-based, not zero-based.
          items.push( { id: data.id, position: index + parentData.offset + 1 } );
        }
      });
      payload.items = items;
      console.log(payload);
      // submit items
      _post( "reorder-all", payload );
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
