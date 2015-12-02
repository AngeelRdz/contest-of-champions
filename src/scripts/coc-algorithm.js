﻿var CoC = CoC || {};
CoC.algorithm = CoC.algorithm || {};

(function(){
  "use strict";

  CoC.algorithm['quest']=new function(){
    this.build=function(options){
      var size = parseInt(options.size, 10), list = [], preselect = [], typeWeights = [], progress = null, team;
      preProcess(options.champions, list, typeWeights, options.levels);
      
      _.filter(list, function(champion){
        if(champion.quest){
          preselect.push(champion);
          return false;
        }
        return true;
      });

      if(options.progress)
        progress={
          current: 0,
          max: combination(list.length, preselect.length? size - preselect.length: size),
          callback: options.progress
        };

      if(preselect.length > 0){      
        if(preselect.length > size){
          team = getTopPartner(preselect, 0, size, typeWeights, progress);
        }
        else{
          team = getNextPartner(list, preselect, [], getTypes(preselect), 0, size, typeWeights, progress);
        }
      }
      else{
        team = getTopPartner(list, 0, size, typeWeights, progress);
      }
        
      return postProcess(team.champions);
    };
    
    function preProcess(champions, list, typeWeights, useLevels){
      var i, fid, champion, uid, stars, quest, synergies;

      for(i=2; i<=5; i++)
        typeWeights[i] = CoC.settings.getDuplicateWeight(i);
        
      for(i=0; i<champions.length; i++){
        fid = champions[i];
        splitValues(fid, '_', function(_uid, _stars, _quest){
          uid = _uid;
          stars = parseInt(_stars, 10);
          quest = _quest === 'true';
        });
        champion = CoC.data.champions.findWhere({ uid:uid, stars:stars });

        synergies = {};
        _(CoC.data.synergies.where({ fromId:uid, fromStars:stars })).each(function(synergy){
          var effect = synergy.effect();
          synergies[synergy.get("toId")]={
            id:synergy.get("toId"),
            fromId:synergy.get("fromId"),
            fromStars:synergy.get("fromStars"),
            value:CoC.settings.getWeight(synergy.get("effectId")) * synergy.get("effectAmount") / effect.get("base")
          };
        });

        list.push({
          fid: fid,
          id:uid,
          stars:stars,
          quest:quest,
          type:CoC.data.types.indexOf(champion.type()),
          synergies:synergies,
          value: (useLevels? champion.value(): 1)
        });
      }  
    }
    
    function postProcess(champions){
      return {
        teams:[
          champions.map(function(champion){
            return champion.fid;
          })
        ],
        extras:[]
      };
    }

    function getTopPartner(list, index, depth, typeWeights, progress){
      if(index >= list.length)
        return null;
      var current = getNextPartner(list, addPartnerHero([], list[index]), [], getTypes([ list[index] ]), index+1, depth, typeWeights, progress);
      if(current === null)
        return null;
      var next = getTopPartner(list,index+1,depth, typeWeights, progress);
      return (compareTeams(current,next) >= 0)? current: next;
    }
    
    function getNextPartner(list, champions, synergies, types, index, depth, typeWeights, progress){
      if(champions.length == depth){
        if(progress)
          progress.callback(++progress.current, progress.max);
        return {
          champions:champions,
          synergies:synergies,
          value:getTeamValue(champions, synergies, types, typeWeights)
        };
      }
      if(index == list.length)
        return null;
      var current = getNextPartner(list, 
        addPartnerHero(champions, list[index]), 
        addPartnerSynergies(synergies, champions, list[index]), 
        addPartnerType(types, list[index]), 
        index+1, depth, typeWeights, progress
      );
      var next = getNextPartner(list, champions, synergies, types, index+1, depth, typeWeights, progress);

      return (compareTeams(current,next) >= 0)? current: next;
    }
    
    function addPartnerHero(list, hero){
      var champions = list.slice();
      champions.push(hero);
      return champions;
    }
    
    function addPartnerType(list, hero){
      var types = list.slice();
      types[hero.type]++;
      return types;
    }

    function getTypes(champions){
      var types=[0,0,0,0,0,0], i;
      if(champions !== undefined)
        for(i=0; i<champions.length; i++)
          types[champions[i].type]++;
      return types;
    }
    
    function addPartnerSynergies(oldSynergies, list, next){
      var synergies = oldSynergies.slice(), i;    
      for(i=0; i<list.length; i++){
        if(list[i].synergies[next.id] !== undefined)
          synergies.push(list[i].synergies[next.id]);
        if(next.synergies[list[i].id] !== undefined)
          synergies.push(next.synergies[list[i].id]);
      }
      return synergies;
    }
    
    function getSynergies(list){
      if(list.length < 2)
        return [];
    
      var champions = [], synergies = [], remaining = champions.slice();
      while(remaining.length > 0){
        var hero = remaining[0];
        remaining.splice(0,1);
        synergies = addPartnerSynergies(synergies, champions, hero);
        champions.push(hero);
      }
      return synergies;
    }
      
    function getTeamValue(champions, synergies, types, typeWeights){
      var vsynergies = 0, vchampions = 0, vtypes = 1, i;
      for(i in synergies)
        vsynergies += synergies[i].value;
      for(i in champions)
        vchampions += champions[i].value;
      for(i in types)
        if(types[i] > 1)
          vtypes *= typeWeights[types[i]];
      return vsynergies * vchampions * vtypes;
    }
    
    function compareTeams(a, b){
      if(b === null)
        return 1;
      return a.value - b.value;
    }
  };

  CoC.algorithm['arena']=new function(){
    this.build=function(options){
      var i, j;
      var size = parseInt(options.size, 10), maxTeams = Math.floor(options.champions.length/size), forceExtras = maxTeams * size;
      var heroMap = {}, synergyMap = {}, typeWeights = {}, teamValues = {};
      preprocess(options.champions, heroMap, synergyMap, typeWeights, options.levels);
    
      var swaps;
      
      function checkValueAndSwap(array, a, b){
        //get team values and counts with swaps
        var v1a = getTeamValue(array, a), v1b = getTeamValue(array, b),
          v2a = getTeamValue(array, a, b), v2b = getTeamValue(array, b, a), 
          count1 = (v1a > 0? 1: 0) + (v1b > 0? 1: 0),
          count2 = (v2a > 0? 1: 0) + (v2b > 0? 1: 0);
        
        //dont accept less teams
        if(count1 > count2)
          return false;
          
        //more teams, or more value
        if(count2 > count1 || (v2a + v2b > v1a + v1b)){
          var tmp = array[a];
          array[a] = array[b];
          array[b] = tmp;
          swaps++;
          return true;
        }
        return false;
      }
    
      function getTeamValue(array, index, swap){
        if(index >= forceExtras)
          return 0;
      
        var start = Math.floor(index/size) * size, team = array.slice(start, start + size);
        if(swap !== undefined)
          team[index % size] = array[swap];
          
        var tid = getTeamId(team), value = teamValues[tid];
        if(value === undefined){
          var hvalue = 0, svalue = 0, types = {};
          for(var i=0; i<team.length; i++){
            var hero = team[i];
            //get my value
            hvalue += hero.value;
            //get my synergies
            var synergies = synergyMap[hero.fid];
            for(var j=0; j<team.length; j++){
              var synergy = synergies[team[j].id];
              if(synergy)
                svalue += synergy.value;
            }
            //get my type dupes
            types[hero.type] = (types[hero.type] || 0) + 1;
          }
          var cvalue = 1;
          for(i in types)
            if(types[i] > 1)
              cvalue *= typeWeights[types[i]] || 1;
          //combine them
          teamValues[tid] = value = hvalue * svalue * cvalue;
        }
        return value;
      }
      
      var progressMax = 16, didExtrasShuffle, array, arrays = [];
      
      function addArray(){
        array = [];
        for(i in heroMap)
          array.push(heroMap[i]);
        shuffle(array);
        arrays.push(array);
        didExtrasShuffle = false;
      }
      
      addArray();
      
      for(var progressCounter=0; progressCounter<progressMax; progressCounter++){
        if(options.progress)
          options.progress(progressCounter, progressMax);
          
        swaps = 0;
        
        //do the swaps
        for(i=0; i<forceExtras; i++)
          for(j=(Math.floor(i/size)+1)*size; j<array.length; j++)
            if(checkValueAndSwap(array, i, j))
              break;
    
        //check if we are missing teams
        var allFull = true;
        for(i=0; i<forceExtras; i+=size)
          if(getTeamValue(array, i) === 0)
            allFull = false;
    
        //exit if we have nothing left to mess with
        if(swaps === 0){
        
          //stuff at the end can be ignored, lets move to empty team
          if(!didExtrasShuffle && !allFull){
            var empty = -1;
            for(i=0; i<forceExtras; i+=size)
              if(getTeamValue(array, i) === 0)
                empty = i;
            if(empty !== -1){
              var tmp;
              for(i=0; i<size && forceExtras+i<array.length; i++){
                tmp = array[empty+i];
                array[empty+i] = array[forceExtras+i];
                array[forceExtras+i] = tmp;
              }
              didExtrasShuffle = true;
              continue;
            }
          }
          
          //start new list
          addArray();
        }
        
      }
      if(options.progress)
        options.progress(progressMax, progressMax);
        
      //get the best array
      var best = {};
      for(i=0; i<arrays.length; i++){
        var current = arrays[i], value = 0;
        for(j=0; j<forceExtras; j+=size)
          value += getTeamValue(current, j);
        if(best.value === undefined || best.value < value){
          best.value = value;
          best.array = current;
        }
      }
    
      return postprocess(best.array, size, function(array, i){ 
        return getTeamValue(array, i);
      });
    };
    
    function preprocess(champions, heroMap, synergyMap, typeWeights, levels){
      var i, fid, uid, stars, champion, synergies;

      for(i=2; i<=5; i++)
        typeWeights[i] = CoC.settings.getDuplicateWeight(i);
    
      for(i=0; i<champions.length; i++){
        fid = champions[i];
        splitValues(fid, '_', function(_uid, _stars){
          uid = _uid;
          stars = parseInt(_stars, 10);
        });
        champion = CoC.data.champions.findWhere({ uid:uid, stars:stars });

        //add hero
        heroMap[fid]={
          id:uid,
          fid:fid,
          type:champion.get("typeId"),
          value:calculateChampionValue(champion, levels)
        };
        synergyMap[fid] = {};
        synergies = CoC.data.synergies.where({ fromId:uid, fromStars:stars });
        for(var s=0;s < synergies.length; s++){
          var synergy = synergies[s];          
          var effect = synergy.effect();
          synergyMap[fid][synergy.get("toId")]={
            value:CoC.settings.getWeight(synergy.get("effectId")) * synergy.get("effectAmount") / effect.get("base")
          };
        }
      }
    }
    
    function postprocess(array, size, getValue){
      var result = { teams:[], extras:[] }, teams = [], i, j;

      for(i=0; i<array.length; i+=size){
        var value = getValue(array, i);
        if(value > 0){
          var team = [];
          for(j=0; j<size; j++)
            team.push(array[i+j].fid);
            
          //sort so same teams don't shuffle around
          team.sort();
          teams.push({ team:team, value:value });
        }
        else
          for(j=0; j<size && i+j<array.length; j++)
            result.extras.push(array[i+j].fid);
      }
      
      //best teams will be first
      teams.sort(function(a,b){ return b.value-a.value; });
      for(i=0; i<teams.length; i++)
        result.teams.push(teams[i].team);

      return result;
    }
    
    //getTeamId
    function getTeamId(team){
      var ids = [];
      for(var i in team)
        ids.push(team[i].fid);
      ids.sort();
      return ids.join('-');
    }
  };
  
  function calculateChampionValue(champion, levels){
    if(levels === false)
      return 1;
    return champion.value();
  }
  
  function factorial(n){
    if(factorial.cache === undefined)
      factorial.cache = { 0:1, 1:1, length:1 };
    if(factorial.cache.length < n){
      for(var i=factorial.cache.length; i <= n; i++)
        factorial.cache[i] = i * factorial.cache[i - 1];
      factorial.cache.length = n;
    }
    return factorial.cache[n];
  }

  function combination(n, r){
    var value = n / factorial(r);
    for(var i = n - 1; i > n - r; i--)
      value *= i;
    return value;
  }

  function shuffle(array){
    var counter = array.length, temp, index;
    while (counter > 0) {
      index = Math.floor(Math.random() * counter);
      counter--;
      if(index != counter){
        temp = array[counter];
        array[counter] = array[index];
        array[index] = temp;
      }
    }
  }

  function splitValues(string, split, callback){
    var values = string.split(split);
    callback.apply(null, values);
  }
  
})();
