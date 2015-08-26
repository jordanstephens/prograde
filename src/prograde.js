var SGP4 = require("sgp4");

var currentPaths = [];

var paramControllers = Array.prototype.slice.call(document.querySelectorAll(".param-controller"));

drawPathForParams(getCurrentParams(paramControllers));

paramControllers.forEach(function(controller) {
  var id = controller.getAttribute("id"),
      valueNode = document.getElementById(id + "-value"),
      unit = controller.getAttribute("data-unit");

  showValue(valueNode, controller.value, unit);

  controller.addEventListener("input", function() {
    drawPathForParams(getCurrentParams(paramControllers));
    showValue(valueNode, controller.value, unit);
  });
});

function getCurrentParams(paramControllers) {
    return paramControllers.reduce(function(memo, c) {
      memo[c.getAttribute("id")] = parseFloat(c.value);
      return memo;
    }, {});
}

function removeCurrentPaths() {
  currentPaths.forEach(function(path) { map.removeLayer(path); });
}

function drawPathForParams(params) {
  params.meanAnomaly = 0.0;

  var model = sgp4modelFromParams(params)
  var paths = generatePaths(model, params.sampleTime);

  removeCurrentPaths();

  currentPaths = paths.map(function(path) {
    return L.polyline(path, {
      color: "red",
      weight: 2
    }).addTo(map);
  });
}

function showValue(valueNode, value, unit) {
  valueNode.textContent = value + (unit || "");
}

function sgp4modelFromParams(params) {

  var gravconst = SGP4.getgravconst("wgs84");
  var G = 6.674e-11;

  var earthmass = 5.972e+24;

  var now = new Date();

  var opsmode = 'i';

  var deg2rad  =  Math.PI / 180.0; //0.0174532925199433
  var xpdotp   =  1440.0 / (2.0 * Math.PI); //229.1831180523293

  var tumin = gravconst.tumin;

  var satrec = {};
  satrec.error = 0;
  satrec.whichconst = gravconst;

  //Line 1
  satrec.satnum = "12345"
  satrec.epochyr = parseInt(now.getUTCFullYear().toString().substr(2, 2));
  satrec.epochdays = (now - (new Date(now.getUTCFullYear(), 0, 0))) / (1000 * 60 * 60 * 24);
  satrec.ndot = undefined; // ignoring for now
  satrec.nddot = undefined; // ignoring for now
  satrec.bstar = 0.000245;

  //Line 2
  satrec.inclo = params.inclination;
  satrec.nodeo = params.rightAscension;
  satrec.ecco = params.eccentricity;
  satrec.argpo = params.argumentOfPerigee;
  satrec.mo = params.meanAnomaly;
  satrec.no = Math.sqrt((earthmass * G) / Math.pow(2 * params.semimajorAxis, 3)) / xpdotp;

  satrec.inclo = satrec.inclo  * deg2rad;
  satrec.nodeo = satrec.nodeo  * deg2rad;
  satrec.argpo = satrec.argpo  * deg2rad;
  satrec.mo    = satrec.mo     * deg2rad;

  satrec.alta = satrec.a*(1.0 + satrec.ecco) - 1.0;
  satrec.altp = satrec.a*(1.0 - satrec.ecco) - 1.0;

  var year = 0;
  if (satrec.epochyr < 57) {
      year = satrec.epochyr + 2000;
  } else {
      year = satrec.epochyr + 1900;
  }

  var days2mdhmsResult = SGP4.days2mdhms(year, satrec.epochdays);
  var mon, day, hr, minute, sec;
  mon = days2mdhmsResult.mon;
  day = days2mdhmsResult.day;
  hr = days2mdhmsResult.hr;
  minute = days2mdhmsResult.minute;
  sec = days2mdhmsResult.sec;

  satrec.jdsatepoch = SGP4.jday(year, mon, day, hr, minute, sec);

  SGP4.sgp4init(gravconst, opsmode, satrec.satnum, satrec.jdsatepoch-2433281.5, satrec.bstar, satrec.ecco, satrec.argpo, satrec.inclo, satrec.mo, satrec.no, satrec.nodeo, satrec);

  return satrec;
}

function resolutionForSamples(samples) {
  if (samples > 7200) {
    return 4
  } else if (samples > 4320) {
    return 2
  } else {
    return 1;
  }
}

function generatePaths(model, samples) {
  var paths = [],
      lastCoord,
      date = new Date(),
      resolution = resolutionForSamples(samples);

  for (var i = 0; i < (samples / resolution); i++) {
    date.setUTCMinutes(date.getMinutes() + resolution);
    var coord = latLongForDate(model, date);

    if (!coord) { break; }

    // if we detect a path break, we need to create a new path
    if (!paths.length || detectPathBreak(lastCoord[1], coord[1])) {
      paths.push([]);
    }

    // add coord to the last created path
    paths[paths.length - 1].push(coord);

    lastCoord = coord;
  }

  paths = paths.concat(paths.map(function(path) {
    return path.map(function(coord) {
      return [coord[0], coord[1] + 360];
    });
  })).concat(paths.map(function(path) {
    return path.map(function(coord) {
      return [coord[0], coord[1] - 360];
    });
  }));

  return paths;
}

function prependPath(path, prevPath) {
  return prevPath.map(function(coord) {
    return [coord[0], coord[1] - 360];
  }).concat(path);
}

function appendPath(path, nextPath) {
  return path.concat(nextPath.map(function(coord) {
    return [coord[0], coord[1] + 360];
  }));
}

function detectPathBreak(lastLon, lon) {
  return ((120 < lastLon && lastLon < 180 && -180 < lon && lon < -120) ||
          (-180 < lastLon && lastLon < -120 && 120 < lon && lon < 180));
}

function latLongForDate(sgp4model, date) {
  var year = date.getUTCFullYear(),
      month = date.getUTCMonth(),
      hours = date.getUTCHours(),
      minutes = date.getUTCMinutes(),
      seconds = date.getUTCSeconds(),
      date = date.getUTCDate(),
      gmst = SGP4.gstimeFromDate(year, month + 1, date, hours, minutes, seconds);

  var state = SGP4.propogate(sgp4model, year, month + 1, date, hours, minutes, seconds);

  if (!(state.position && state.velocity)) {
    console.log("Error:", sgp4model.error, sgp4model.error_message);
    return null;
  }

  var geodeticCoordinates = SGP4.eciToGeodetic(state.position, gmst),
      longitude = SGP4.degreesLong(geodeticCoordinates.longitude),
      latitude = SGP4.degreesLat(geodeticCoordinates.latitude);

  return [latitude, longitude];
}
