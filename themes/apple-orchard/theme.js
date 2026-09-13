(function(global){
  function pctPolygon(points){
    const pts=points.map(p=>`${p.x}% ${p.y}%`);
    pts.push('100% 100%','0% 100%');
    return `polygon(${pts.join(',')})`;
  }
  function install(config){
    return {
      id:config.id,
      getHereSlots(count){ return config.basket.pile.slice(0, Number(count)||0); },
      getFrontMask(){ return pctPolygon(config.basket.frontMask); },
      zoneTransform(){ return config.basket.zoneTransform; },
      counterOffsets(){ return config.counters; },
      assets:config.assets,
      behavior:config.behavior
    };
  }
  global.LittleAttendanceThemes=global.LittleAttendanceThemes||{};
  global.LittleAttendanceThemes.appleOrchard={install};
})(window);
