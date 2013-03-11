$(function() {
  $("#command-menu").off("change").on("change", function(e) {
    var command = $(this).val();
    switch (command) {
      case "edit":
        var pageInfo = $("body").data();
        var ids = [];
        $("input[type=checkbox][name=id]:checked").each(function(index, el) { ids.push( $(el).val() ); });
        location.href = window.caribou.api.routeFor("to-route", {
          page: "edit_model_instance",
          id: ids.join(":"),
          slug: pageInfo.model
        });
        break;
      default:
    };
  }).show();
});