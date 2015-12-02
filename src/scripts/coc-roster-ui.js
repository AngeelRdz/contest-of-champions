var CoC = CoC || {};
CoC.ui = CoC.ui || {};

CoC.ui.workerScriptUrl = 'worker-teams.js?' + parseInt(new Date().getTime() % 1000000).toString(16);

CoC.ui.initialize=function(){
  //nothing
};

//View logic for pages
CoC.ui.roster=new function(){

  this.initialize=function(){
    if(this._initialized)
      return;
    this.view = new CoC.view.RosterView({
      el: $("#roster")[0]
    });
    this._initialized = true;
  };
  
  this.popup=function(element, champion){
    var i;
  
    $(element).addClass("selected");
    $('#popup-roster-configure').one("popupafterclose", function(){
      $(element).removeClass("selected");
      $("#roster-configure-image").prop("src", "");
    });
    
    $("#roster-configure-stars").text("");
    $("#roster-configure-stars").append((function(){
      var string = "";
      for(var i=0;i<champion.get("stars");i++)
        string+="<span class='star'></span>";
      return string;
    })());
    if(champion.get("awakened") > 0)
      $("#roster-configure-stars").addClass("awakened");
    else
      $("#roster-configure-stars").removeClass("awakened");

      
    $(".roster-configure-guide").unbind("click").bind("click",function(e){
      e.preventDefault();
      $('#popup-roster-configure').one("popupafterclose", function(){
        CoC.ui.guides.open( champion.get("uid") );
      });
      $('#popup-roster-configure').popup("close");
      
    });

    $("#roster-configure-image").prop("src", champion.image());
    $("#roster-configure-name").prop("class", champion.get("typeId")).text(champion.get("name"));
    
    $("#roster-configure-type").prop("src", CoC.data.types.findWhere({ uid:champion.get("typeId") }).get("image"));

    function setupRankLevel(){
      $("#roster-configure-level").empty();
      for(var i = 1, levels = champion.levels(); i<=levels; i++)
        $("#roster-configure-level").append($("<option>").val(i).text(i));
        
      $("#roster-configure-level").unbind("change").change(function(e){
        var value = parseInt(e.target.value, 10);
        champion.set("level", value);
        champion.save();
        $("#roster-configure-level").selectmenu('refresh');
      }).val(champion.get("level")).selectmenu('refresh');
    }
    
    $("#roster-configure-rank").empty();
    for(i = 1, ranks = champion.ranks(); i<=ranks; i++)
      $("#roster-configure-rank").append($("<option>").val(i).text(i));
    $("#roster-configure-rank").unbind("change").change(function(e){
      var value = parseInt(e.target.value, 10);
      champion.set("rank", value);
      champion.set("level", 1);
      champion.save();
      setupRankLevel();
      $("#roster-configure-rank").selectmenu('refresh');
    }).val(champion.get("rank")).selectmenu('refresh');
    
    setupRankLevel();
    
    $("#roster-configure-awakened").empty();
    $("#roster-configure-awakened").append($("<option>").val(0).text(CoC.lang.string('none')));
    for(i = 1; i<=99; i++)
      $("#roster-configure-awakened").append($("<option>").val(i).text(i));
    $("#roster-configure-awakened").unbind("change").change(function(e){
      var value = parseInt(e.target.value, 10);
      champion.set("awakened", value);
      champion.save();
      $("#roster-configure-awakened").selectmenu('refresh');
      $("#roster-configure-stars").attr("class", (value > 0)? "awakened": "");
    }).val(champion.get("awakened")).selectmenu('refresh');
    
    $("#roster-configure-quest").prop("checked", champion.get("quest")).checkboxradio("refresh").unbind("change").change(function(e){
      champion.set("quest", (e.target.checked)? true: false);
      champion.save();
    });
    
    $("#roster-configure-delete").unbind("click").click(function(e){
      e.preventDefault();
      $("#roster .champion").removeClass("selected");
      $('#popup-roster-configure').one("popupafterclose", function(){
        $("#popup-roster-delete-confirm").popup("open",{
          positionTo:"window"
        });
      });
      $('#popup-roster-configure').popup("close");
    });
    
    $("#roster-delete-confirm-name").attr("class", champion.get("typeId")).text(champion.get("name"));
    $("#roster-delete-confirm-stars").text("").attr("class", (champion.get("awakened") > 0)? "awakened": "");
    for(i=0; i<champion.get("stars");i++)
      $("#roster-delete-confirm-stars").append($("<span>",{ class:'star' }));
    $("#roster-delete-confirm-yes").unbind("click").click(function(e){
      e.preventDefault();
      var uid = champion.get('uid'),
        stars = champion.get('stars');
      $("#popup-roster-delete-confirm").popup("close");
      champion.destroy();
      CoC.tracking.event("roster", "delete", uid + '-' + stars);
    });
    $("#roster-delete-confirm-no").unbind("click").click(function(e){
      e.preventDefault();
      $("#popup-roster-delete-confirm").popup("close");
    });
    
    $('#popup-roster-configure').popup("open",{
      positionTo:$(element)
    });
  
  };
  
  this.render=function(){
    this.view.render();
  };
};

CoC.ui.add=new function(){
  
  this.initialize=function(){
    if(this._initialized)
      return;
    this._stars = 2;
    this.view = new CoC.view.AddChampionsView({
      el: $("#add-champions")[0]
    });
    this.view.stars(this._stars);
    this._initialized = true;
  };

  this.setStars=function(stars){
    this._stars = stars;
    this.view.stars(this._stars);
    this.render();
  };
  
  this.render=function(){
    this.view.render();
    $("#page-add #add-stars a").removeClass("ui-btn-active");
    $("#page-add #add-stars a[stars=" + this._stars + "]").addClass("ui-btn-active");
  };
  
  this.show=function(){
    //nothing to do here
  };
};
CoC.ui.teams=new function(){
  var useWorkers = window.Worker !== undefined && 
    !(window.location.protocol == "file:" && navigator.userAgent.toLowerCase().indexOf('chrome') > -1);

  this.initialize=function(){
    if(this._initialized)
      return;
    this.initWorker();
    this.view = new CoC.view.TeamView({
      el: $("#teams")[0]
    });
    this._initialized = true;
  };

  this.empty = true;
 
  this.render=function(result, size){
    $("#teams").removeClass("dirty");
  
    this.empty = false;
    this.view.size(size);
    this.view.teams(result.teams);
    this.view.extras(result.extras);
    this.view.render();
  };
  
  this.initWorker=function(){
    if(!useWorkers)
      return;  
    this._nextWorker = new Worker(CoC.ui.workerScriptUrl);
  };
  
  this.getWorker=function(){
    if(!useWorkers)
      return null;  
    this.destroyWorker();
    this._currentWorker = this._nextWorker || new Worker(CoC.ui.workerScriptUrl);
    this._nextWorker = new Worker(CoC.ui.workerScriptUrl);
    return this._currentWorker;
  };
  
  this.destroyWorker=function(){
    if(!useWorkers)
      return;
    if(this._currentWorker){
      this._currentWorker.terminate();
      delete this._currentWorker;
    }
  };

  this.progress = function(progress){
    if(progress.description){
      $("#onboarding-progress .text").text(progress.description);
      $("#onboarding-progress").addClass("show");
    }
    else
      $("#onboarding-progress").removeClass("show");
    $("#team-build-progress input").val(Math.min(1000 * (progress.current / progress.max), 1000)).slider("refresh");
  };

  this.progress.show = function(){
    $("#team-build-progress input").val(0).slider("refresh");
    $("#team-build-progress").removeClass("hidden");
    $('body').addClass('building');
  };

  this.progress.hide = function(){
    $("#team-build-progress input").val(10000).slider("refresh");
    $("#team-build-progress").addClass("hidden");
    $("#onboarding-progress").removeClass("show");
    $('body').removeClass('building');
  };

  this.build = function(){
    $("#teams").addClass("dirty");
    
    var size = CoC.settings.getValue("build-size") || 3;
    var roster = CoC.roster.filtered();
    var algorithm = CoC.settings.getValue("build-type");
    var levels = CoC.settings.getValue("build-levels") === true;
    var champions = [];
    for(var i=0; i<roster.length; i++)
      champions.push(roster[i].fid());

    CoC.ui.teams.progress.show();
    
    var startTime = new Date();
    var worker = CoC.ui.teams.getWorker();
    if (worker){
      try{
        //Setup and start the worker
        worker.onmessage=function(event){
          var i, j;
          if(event.data.type === "progress"){
            CoC.ui.teams.progress(event.data.progress);
          }
          if(event.data.type === "failed"){
            CoC.ui.teams.progress.hide();
            CoC.ui.teams.render(event.data.result, size);
            CoC.utils.error(event.data.message);
          }
          if(event.data.type === "complete"){
            CoC.utils.log({
              style: 'search',
              value: CoC.lang.model('algorithm-'+algorithm+'-name') + " search completed in "+((new Date() - startTime) / 1000)+"s"
            });

            //Convert the result back to Champion models post-transport
            var result = {}, fid, champion;
            if(event.data.result.teams !== undefined){
              result.teams=[];
              for(i=0; i<event.data.result.teams.length; i++){
                var team = [];
                for(j=0; j<event.data.result.teams[i].length; j++){
                  fid = event.data.result.teams[i][j].split('_');
                  champion = CoC.data.roster.findWhere({ uid:fid[0], stars:parseInt(fid[1], 10) });
                  if(champion)
                    team.push(champion);
                }
                result.teams.push(team);
              }
            }
            if(event.data.result.extras !== undefined){
              result.extras=[];
              for(i=0; i<event.data.result.extras.length; i++){
                fid = event.data.result.extras[i].split('_');
                champion = CoC.data.roster.findWhere({ uid:fid[0], stars:parseInt(fid[1], 10) });
                if(champion)
                  result.extras.push(champion);
              }
            }
            
            //update the UI
            CoC.ui.teams.render(result, size);
            CoC.ui.teams.progress.hide();
            CoC.tracking.event("teams", "build", algorithm + '-' + size);
          }
        };
        worker.postMessage({
          type: 'build',
          options:{
            algorithm: algorithm,
            champions: champions, 
            size: size, 
            levels: levels,
            weights: CoC.settings.weights
          }
        });
      }
      catch(e){
        CoC.ui.teams.progress.hide();
        console.error(e);
      }
    }
  };
};

CoC.ui.guides=new function(){

  this.initialized = false;
  this.shown = false;
  this.seen = false;
  
  this.initialize=function(){
    if(this._initialized)
      return;

    this.view = new CoC.view.GuideChampionsView({
      el: $("#guide-champions")[0]
    });
    this.view.render();
    if(this.shown)
      this.show();

    this._initialized = true;
  };
  
  this.open=function(uid){
    this._uid = uid;
    $.mobile.changePage("#page-guide",{
      transition:"fade"
    });
  };

  this.render=function(){
    if(!this.view)
      return;
      
    this.view.render();
  };
  
  this.show=function(){
    if(!this.view){
      this.shown = true;
      return;
    }
    
    var uid = CoC.getUrlParam("page-guide", "guide") || this.view.selected();
    if(this._uid){
      uid = this._uid;
      delete this._uid;
    }
    this.seen = true;
    
    this.view.enable();
    this.view.reload();
    this.view.select(uid);
  };
  
  this.hide=function(){
    if(!this.view)
      return;
    this.view.disable();
  };
};
CoC.ui.crystals=new function(){
  
  this.initialize=function(){
    if(this._initialized)
      return;
    this.view = new CoC.view.CrystalsView({
      el: $("#crystals")[0]
    });
    this._initialized = true;
  };
  
  this.render=function(){
    this.view.render();
  };
};

//Load onboarding when appropriate
$("#page-roster").on("pageshow", function() {
  if(CoC.data.roster.length === 0){
    $("#onboarding-roster").addClass("show");
    $("#page-roster").one("click",function(){
      $("#onboarding-roster").removeClass("show");
    });
  }
});
$("#page-teams").on("pageshow", function() {
  if(CoC.ui.teams.empty && $("#team-build-progress").hasClass("hidden")){
    $("#onboarding-teams").addClass("show");
    $("#page-teams").one("click",function(){
      $("#onboarding-teams").removeClass("show");
    });
  }
});

//handle checking and clearing selections on page swipes
CoC.ui.hasSelection=function(){
  var text = "";
  if (window.getSelection) {
      text = window.getSelection().toString();
  } else if (document.selection && document.selection.type != "Control") {
      text = document.selection.createRange().text;
  }
  return text.length > 0;
};
CoC.ui.clearSelection=function(){
  if ( document.selection ) {
    document.selection.empty();
  } else if ( window.getSelection ) {
    window.getSelection().removeAllRanges();
  }
};

//Make swipes move to the next screen
$(document).on("pagecreate", "#page-roster", function() {
  $(document).on("swiperight", "#page-roster", function( e ) {
    if(CoC.ui.hasSelection())
      return;
    if($("#page-roster").find(".ui-popup-active").length || $("#page-roster").find(".ui-panel-open").length)
      return;
    $("#page-roster").find("#header a[href=#panel-roster-options]").click();
    setTimeout(CoC.ui.clearSelection, 50);
  });
});

//Make swipes move to the last screen or open the panel
$(document).on("pagecreate", "#page-teams", function() {
  $(document).on("swiperight", "#page-teams", function( e ) {
    if(CoC.ui.hasSelection())
      return;
    if($("#page-teams").find(".panel").hasClass("ui-panel-open"))
      return;
    $("#page-teams").find("#header a[href=#panel-team-settings]").click();
    setTimeout(CoC.ui.clearSelection, 50);
  });
});
  
//Handle opening/closing pages 
$("#page-roster").on("pagebeforeshow",function(){
  CoC.ui.roster.initialize();
  CoC.ui.roster.render();
});
$("#page-add").on("pagebeforeshow",function(){
  CoC.ui.add.initialize();
  CoC.ui.add.render();
});
$("#page-teams").on("pagebeforeshow",function(){
  CoC.ui.teams.initialize();
});
$("#page-add").on("pageshow",function(){
  CoC.ui.add.show();
});
$("#page-guide").on("pagebeforeshow",function(){
  CoC.ui.guides.initialize();
  CoC.ui.guides.render();
});
$("#page-guide").on("pageshow",function(){
  CoC.ui.guides.show();
});
$("#page-guide").on("pagehide",function(){
  CoC.ui.guides.hide();
});
$("#page-crystals").on("pagebeforeshow",function(){
  CoC.ui.crystals.initialize();
  CoC.ui.crystals.render();
});

//Initialize inputs
$("#page-roster").on("pagecreate",function(){

  //csv importer
  if(window.FileReader){
    $('#roster-import-input').change(function(e){
      if (this.files && this.files[0]) {
        var reader = new FileReader();
        var file = this.files[0];
        CoC.utils.log({ style: 'io', value: "Importing champions..." },{ style: 'filename', value: file.name });
        reader.onload = function (e) {
          var result = e.target.result;
          CoC.roster.csvImport(result, file.name || undefined);
          CoC.ui.roster.render();
        };
        reader.readAsText(file);
        $(this).val("");
      }
    });
    $('#roster-import').click(function(){
      $('#roster-import-input').click();
      $('#panel-roster-options').panel("close");
      CoC.tracking.event("roster", "import");
    });
  }
  //windows safari and other bullshit browsers that dont support FileReader
  else{
    $('#roster-import').addClass("ui-disabled");
  } 
  
  //csv exporter
  $('#roster-export').click(function(){
    var csvRoster;
    var csvRosterName = 'champions.csv';
    CoC.utils.log({ style: 'io', value: "Exporting champions..." },{ style: 'filename', value: csvRosterName });
    if (isInternetExplorer()){
      csvRoster = CoC.roster.csvExport('\r\n');
      rosterExportFrame.document.open("text/html", "replace");
      rosterExportFrame.document.write('sep=,\r\n' + csvRoster);
      rosterExportFrame.document.close();
      rosterExportFrame.focus();
      rosterExportFrame.document.execCommand('SaveAs', true, csvRosterName);
    }
    else{
      csvRoster = CoC.roster.csvExport();
      $('#roster-export')
        .attr('download', csvRosterName)
        .attr('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csvRoster));
    }
    $('#panel-roster-options').panel("close");
    CoC.tracking.event("roster", "export");
  }); 
  
  $('#roster-clear-all').click(function(){
    $('#panel-roster-options').panel("close");
    $("#popup-roster-clear-confirm").popup("open",{
      positionTo:"window"
    });
  });
  $("#roster-clear-confirm-no").click(function(){
    $("#popup-roster-clear-confirm").popup("close");
  });
  $("#roster-clear-confirm-yes").click(function(){
    CoC.roster.clear();
    CoC.ui.roster.render();
    $("#popup-roster-clear-confirm").popup("close");
    $('#panel-roster-options').panel("close");
    CoC.tracking.event("roster", "delete", "all");
  });

  var sorts = [ "stars", "type", "name" ];
  _(sorts).each(function(sort){
    function setAscendingDescending(){
      if(CoC.settings.getValue("roster-sort-direction") === "ascending")
        $("label[for=roster-sort-"+sort+"]").removeClass("ui-descending").addClass("ui-ascending");
      else
        $("label[for=roster-sort-"+sort+"]").removeClass("ui-ascending").addClass("ui-descending");
    }
    var element = $('#roster-sort-' + sort);
    element.change(function(){
      var newSort = CoC.settings.getValue("roster-sort") !== sort;
      var wasAscending = CoC.settings.getValue("roster-sort-direction") === "ascending";
      CoC.settings.setValue("roster-sort-direction", (newSort || wasAscending)? "descending": "ascending");
      CoC.settings.setValue("roster-sort", sort);
      setAscendingDescending();
      CoC.ui.roster.render();
    });
    element.prop("checked", (CoC.settings.getValue("roster-sort") === sort)? true: false).checkboxradio('refresh');
    setAscendingDescending();
  });
  
  var filters = [
    'roster-filter-stars-1',
    'roster-filter-stars-2',
    'roster-filter-stars-3',
    'roster-filter-stars-4',
    'roster-filter-stars-5'
  ];
  for(var i=0; i<filters.length; i++)
    (function(filter){
      $('#'+filter).change(function(){
        CoC.settings.setValue(filter, this.checked);
        CoC.ui.roster.render();
      })
      .prop("checked", CoC.settings.getValue(filter)? true: false)
      .checkboxradio('refresh');
    })(filters[i]);
});
$("#page-add").on("pagecreate",function(){
  $("#page-add #add-stars a").each(function(i, obj){
    var button = $(obj),
      stars = parseInt(button.attr("stars"), 10);
    button.on("click", function(){
      CoC.ui.add.setStars(stars);
      return false;
    });
  });
});
$("#page-teams").on("pagecreate", function() {
  var i;

  $("#team-build-progress").addClass("hidden");
  $("#team-build-progress input").css('opacity', 0).css('pointer-events','none');
  $("#team-build-progress .ui-slider-handle").remove();
  $('#team-build-progress .ui-slider-track').css('margin','0 15px 0 15px').css('pointer-events','none');
  
  var teamSettingsSize = $('input:radio[name=build-settings-size]');
  teamSettingsSize.filter('[value='+CoC.settings.getValue("build-size")+']').prop("checked", true).checkboxradio("refresh");
  teamSettingsSize.change(function(){ 
    CoC.settings.setValue("build-size",this.value); 
  });
    
  var filters = [
    'build-filter-stars-1',
    'build-filter-stars-2',
    'build-filter-stars-3',
    'build-filter-stars-4',
    'build-filter-stars-5'
  ];
  for(var f=0; f<filters.length; f++)
    (function(filter){
      $('#'+filter).change(function(){
        CoC.settings.setValue(filter, this.checked);
      })
      .prop("checked", CoC.settings.getValue(filter)? true: false)
      .checkboxradio('refresh');
    })(filters[f]);

  var algorithm = $('input:radio[name=build-settings-type]');
  algorithm.filter('[value='+CoC.settings.getValue("build-type")+']').prop("checked", true).checkboxradio("refresh");
  algorithm.change(function(){ 
    CoC.settings.setValue("build-type",this.value); 
    updateAlgorithmDescription();
  });

  function updateAlgorithmDescription(){
    algorithm = CoC.settings.getValue("build-type");
    $('#build-settings-type-description').text( CoC.lang.model('algorithm-'+algorithm+'-description') );
  }
  updateAlgorithmDescription();

  
  $("#button-build-settings-apply").click(function(){
    $("#panel-team-settings").panel("close");
    CoC.ui.teams.build();
  });
});
$("#page-settings-advanced").on("pagecreate", function() {
  var sliders = {}, checkboxes = {};

  function enableSlider(category, type){
    var id = "#settings-advanced-"+type,
      presetId = "#settings-advanced-preset-"+category,
      value = CoC.settings.getWeight(type);
    $(id).val(value * 100).slider("refresh").change(function(){
      CoC.settings.setWeight(type, parseInt(this.value) / 100.0);
      $(presetId).val(null).selectmenu("refresh");
    });
    sliders[type]=id;
  }
  enableSlider("synergies", "attack");
  enableSlider("synergies", "stun");
  enableSlider("synergies", "critrate");
  enableSlider("synergies", "critdamage");
  enableSlider("synergies", "perfectblock");
  enableSlider("synergies", "block");
  enableSlider("synergies", "powergain");
  enableSlider("synergies", "armor");
  enableSlider("synergies", "health");
  enableSlider("duplicates", "duplicates-2");
  enableSlider("duplicates", "duplicates-3");
  enableSlider("duplicates", "duplicates-4");
  enableSlider("duplicates", "duplicates-5");

  function enableCheckbox(id, type){
    var value = CoC.settings.getValue(type);
    $(id).prop("checked", value).checkboxradio("refresh").change(function(){
      CoC.settings.setValue(type, this.checked);
    });
    checkboxes[type]=id;
  }
  enableCheckbox("#settings-advanced-levels","build-levels");
  
  function addPresets(category){
    var container = $("#settings-advanced-preset-"+category.toLowerCase()),
      presets = CoC.settings.preset.ids(category);      
    for(var i in presets){
      var preset = CoC.settings.preset.info(presets[i]);
      container.append($('<option>', { value:preset.id }).text( preset.name ));
    }
  }
  addPresets("Synergies");
  addPresets("Duplicates");
  
  $("#settings-advanced-preset-defaults").click(function(){
    CoC.settings.preset.apply("defaults", function(key, value){
      var slider = $(sliders[key]);
      if(slider.length){
        slider.val(value * 100).slider("refresh");
        return true;
      }
      return false;
    }, function(key, value){
      var checkbox = $(checkboxes[key]);
      if(checkbox.length){
        checkbox.prop("checked",value).checkboxradio("refresh");
        return true;
      }
      return false;
    });
    $("#settings-advanced-preset-synergies, #settings-advanced-preset-duplicates").val(null).selectmenu("refresh");
  });
  
  $("#settings-advanced-preset-synergies, #settings-advanced-preset-duplicates").change(function(){
    CoC.settings.preset.apply(this.value, function(key, value){
      var slider = $(sliders[key]);
      if(slider.length){
        slider.val(value * 100).slider("refresh");
        return true;
      }
      return false;
    });
  });
});

$("#page-guide").on("pagecreate",function(){
  $("#button-select-guide").on("tap click", function(){
    $("#guide-champions-selector").selectmenu("open");
    return false;
  });
});
    
//close dialogs when we click outside of them or click escape
$.mobile.document.on("tap click", "[data-role=dialog]", function(event, ui){
  if(event.target === this){
    $(this).dialog("close");
  }
}).on("keyup", "[data-role=dialog]", function(event, ui){
  if(event.keyCode == 27){
    $(this).dialog("close");
  }
});

//Tracking for pages that have the data attribute
$('[data-tracking=true]').on('pageshow', function(){
  var path = location.pathname;
  if(location.hash)
    path += location.hash;
  CoC.tracking.pageView(path);
});

function isInternetExplorer() {
  return (
    window.navigator.userAgent.indexOf("MSIE ") !== -1 || 
    window.navigator.userAgent.indexOf("Edge ") !== -1 || 
    !!navigator.userAgent.match(/Trident.*rv\:11\./)
  )? true: false;
}

//remove '&ui-state=dialog' from url hash when loading
(function(){
  var hash = location.hash.replace(/([&][u][i][-][s][t][a][t][e][=][d][i][a][l][o][g])/g, '');
  if(hash !== location.hash)
    location.hash = hash;
})();
