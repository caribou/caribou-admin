(function (global) {
    function breadcrumbs() {
      var _breadcrumbFormats = {
        link: _.template('<li> <a href="{{url}}">{{text}}</a> </li>'),
        text: _.template('<li> {{text}} </li>')
      };
      var self = {
        push: function( opts ) {
          var breadcrumb = _breadcrumbFormats.text( opts );
          if ( opts.url ) {
            breadcrumb = _breadcrumbFormats.link( opts );
          }
          $(".breadcrumb li:last").append('<span class="divider">/</span>');
          $(breadcrumb).appendTo(".breadcrumb");
        },
        pop: function() {
          $(".breadcrumb li:last").remove()
          $(".breadcrumb li:last span.divider").remove();
        },
        clear: function() {
          $(".breadcrumb li").remove();
        }
      };
      return self;
    }

    global.caribou = global.caribou || {};
    global.caribou.breadcrumbs = breadcrumbs();
})(window);