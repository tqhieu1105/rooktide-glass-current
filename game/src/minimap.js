import { DISTRICTS } from './config.js';
import { findWaypointRoute } from './roads.js';

// The only 2D drawing context in the game. All world rendering is WebGL.
export function createMinimap(canvas, world) {
  const context = canvas.getContext('2d');
  const size = 208; canvas.width = size * 2; canvas.height = size * 2;
  const map = document.createElement('canvas');
  map.width = 1200; map.height = 880;
  {
    const c = map.getContext('2d');
    c.translate(530, 440);
    c.fillStyle = '#3c5553'; c.fillRect(-530, -440, 1019, 880);
    c.fillStyle = '#827257'; c.fillRect(451, -440, 38, 880); c.fillRect(526, -305, 85, 130);
    c.fillStyle = '#263b3c';
    for (const h of world.buildings) c.fillRect(h.x - h.width / 2, h.z - h.depth / 2, h.width, h.depth);
    c.lineCap = 'square';
    for (const [stroke, rim] of [['#273338', 2.5], ['#c2b9a2', 0]]) {
      c.strokeStyle = stroke;
      for (const edge of world.roads.edges) {
        c.lineWidth = edge.width + rim; c.beginPath(); c.moveTo(edge.x1, edge.z1); c.lineTo(edge.x2, edge.z2); c.stroke();
      }
    }
  }
  const ring = canvas.closest('.map-wrap');
  let lastX = Infinity, lastZ = Infinity, lastHeading = Infinity, lastFacing = Infinity, lastCarX = Infinity, lastCarZ = Infinity;
  let lastCarHeading = Infinity, lastExpanded, lastDriving, lastVisited = -1;
  let lastPolice = false;
  let lastWaypoint = '', lastScan = false, route = [], routeOrigin = null, routeEnd = '';
  function drawRotatingMinimap(player, car, heading, expanded = false, police, waypoint, scan = false) {
    const waypointKey = waypoint ? `${Math.round(waypoint.x)}:${Math.round(waypoint.z)}:${waypoint.style}` : '';
    if (waypoint && (waypointKey !== routeEnd || !routeOrigin || Math.hypot(player.x - routeOrigin.x, player.z - routeOrigin.z) >= 8)) {
      route = findWaypointRoute(world.roads, player, waypoint);
      routeOrigin = { x: player.x, z: player.z }; routeEnd = waypointKey;
    }
    const policeActive = police.wanted.level > 0;
    const x = Math.round(player.x), z = Math.round(player.z);
    const angle = Math.round(heading * 90), facing = Math.round(player.heading * 90);
    const carX = Math.round(car.x), carZ = Math.round(car.z), carHeading = Math.round(car.heading * 90);
    if (x === lastX && z === lastZ && angle === lastHeading && facing === lastFacing && lastExpanded === expanded
      && waypointKey === lastWaypoint && scan === lastScan && lastDriving === player.inVehicle && lastVisited === world.visited.size && !policeActive && !lastPolice
      && (player.inVehicle || carX === lastCarX && carZ === lastCarZ && carHeading === lastCarHeading)) return;
    lastX = x; lastZ = z; lastHeading = angle; lastFacing = facing; lastExpanded = expanded;
    lastDriving = player.inVehicle; lastVisited = world.visited.size;
    lastPolice = policeActive; lastWaypoint = waypointKey; lastScan = scan;
    lastCarX = carX; lastCarZ = carZ; lastCarHeading = carHeading;
    const c = context, scale = expanded ? 0.22 : 0.77;
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, size, size);
    ring.classList.toggle('expanded', expanded);
    c.save(); c.beginPath(); c.arc(size / 2, size / 2, 104, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#163740'; c.fillRect(0, 0, size, size);
    c.translate(size / 2, size / 2); c.rotate(heading); c.scale(scale, scale); c.translate(-player.x, -player.z);
    c.drawImage(map, -530, -440, 1200, 880);
    if (police.wanted.state === 'search') {
      const { lastSeen, searchRadius } = police.wanted;
      c.fillStyle = '#f0745055'; c.strokeStyle = '#ffb472'; c.lineWidth = 1.5 / scale;
      c.beginPath(); c.arc(lastSeen.x, lastSeen.z, searchRadius, 0, Math.PI * 2); c.fill(); c.stroke();
    }
    const waypointColor = waypoint?.style === 'contact' ? '#ffd17f' : waypoint?.style === 'target' ? '#ff9c95' : '#a1ffda';
    if (waypoint) {
      c.lineWidth = 5.6 / scale; c.strokeStyle = '#152b2d'; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath(); c.moveTo(player.x, player.z);
      for (const node of route) c.lineTo(node.x, node.z);
      c.lineTo(waypoint.x, waypoint.z); c.stroke();
      c.lineWidth = 2.8 / scale; c.strokeStyle = waypointColor; c.stroke();
    }
    for (const district of DISTRICTS) {
      if (expanded) marker(district, world.visited.has(district.id) ? '#ffe0a1' : '#8eb5af', 3.8, 'square');
    }
    if (!player.inVehicle) {
      c.save(); c.translate(car.x, car.z); c.rotate(car.heading);
      c.fillStyle = '#fa9876'; c.fillRect(-3 / scale, -5 / scale, 6 / scale, 10 / scale); c.restore();
    }
    function marker(actor, fill, radius, shape) {
      const { x, z } = actor, r = radius / scale;
      c.fillStyle = fill; c.strokeStyle = '#142328'; c.lineWidth = 2 / scale;
      c.beginPath();
      if (shape === 'diamond') { c.moveTo(x, z-r); c.lineTo(x+r, z); c.lineTo(x, z+r); c.lineTo(x-r, z); c.closePath(); }
      else if (shape === 'square') c.rect(x-r, z-r, r*2, r*2);
      else c.arc(x, z, r, 0, Math.PI * 2);
      c.fill(); c.stroke();
    }
    function edgePin(actor, fill, radius, shape) {
      const dx = actor.x - player.x, dz = actor.z - player.z;
      const ratio = Math.min(1, 91 / (Math.hypot(dx, dz) * scale));
      marker({ x: player.x + dx * ratio, z: player.z + dz * ratio }, fill, radius, shape);
    }
    if (waypoint) edgePin(waypoint, waypointColor, 7.5, 'diamond');
    for (const unit of police.units) if (unit.active) {
      if (scan && policeActive) edgePin(unit, '#ffae89', 4.5);
      else marker(unit, '#ff857d', 5);
    }
    if (police.helicopter.active) edgePin(police.helicopter, '#8ce9ff', 5, 'square');
    for (const block of police.roadblocks) if (block) marker(block, '#ffd05d', 5, 'square');
    c.restore();
    c.save(); c.translate(size / 2, size / 2); c.rotate(heading - player.heading);
    c.fillStyle = '#f9e5b5'; c.strokeStyle = '#18383d'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.save(); c.translate(size / 2, size / 2); c.rotate(heading); c.translate(0, -86); c.rotate(-heading);
    c.font = '700 17px Barlow Condensed, Arial Narrow, sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
    c.strokeStyle = '#142328'; c.lineWidth = 4; c.strokeText('N', 0, 0);
    c.fillStyle = '#fff0d3'; c.fillText('N', 0, 0); c.restore();
  }
  document.fonts.ready.then(() => { lastVisited = -1; });
  return { drawRotatingMinimap };
}
