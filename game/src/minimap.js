import { DISTRICTS } from './config.js';

// The only 2D drawing context in the game. All world rendering is WebGL.
export function createMinimap(canvas, world) {
  const context = canvas.getContext('2d');
  const size = 208; canvas.width = size * 2; canvas.height = size * 2;
  function drawRotatingMinimap(player, car, heading, expanded = false) {
    const c = context, scale = expanded ? 0.22 : 0.77;
    c.setTransform(2, 0, 0, 2, 0, 0); c.clearRect(0, 0, size, size);
    c.save(); c.beginPath(); c.arc(size / 2, size / 2, 99, 0, Math.PI * 2); c.clip();
    c.fillStyle = '#193f45'; c.fillRect(0, 0, size, size);
    c.translate(size / 2, size / 2); c.rotate(heading); c.scale(scale, scale); c.translate(-player.x, -player.z);
    c.fillStyle = '#7c8b7c'; c.fillRect(-530, -440, 1019, 880);
    c.fillStyle = '#ccba8d'; c.fillRect(451, -440, 38, 880); c.fillRect(526, -305, 85, 130);
    c.fillStyle = '#626d67';
    for (const h of world.buildings) c.fillRect(h.x - h.width / 2, h.z - h.depth / 2, h.width, h.depth);
    c.strokeStyle = '#d3c9ac'; c.lineCap = 'square';
    for (const edge of world.roads.edges) {
      c.lineWidth = edge.width; c.beginPath(); c.moveTo(edge.x1, edge.z1); c.lineTo(edge.x2, edge.z2); c.stroke();
    }
    for (const district of DISTRICTS) {
      c.fillStyle = world.visited.has(district.id) ? '#ffe0a1' : '#92b7b0';
      c.beginPath(); c.arc(district.x, district.z, 5 / scale, 0, Math.PI * 2); c.fill();
    }
    if (!player.inVehicle) {
      c.save(); c.translate(car.x, car.z); c.rotate(car.heading);
      c.fillStyle = '#fa9876'; c.fillRect(-3 / scale, -5 / scale, 6 / scale, 10 / scale); c.restore();
    }
    c.restore();
    c.save(); c.translate(size / 2, size / 2); c.rotate(heading - player.heading);
    c.fillStyle = '#f9e5b5'; c.strokeStyle = '#18383d'; c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -10); c.lineTo(7, 8); c.lineTo(0, 4); c.lineTo(-7, 8); c.closePath(); c.fill(); c.stroke(); c.restore();
    c.save(); c.translate(size / 2, size / 2); c.rotate(heading);
    c.fillStyle = '#f5dfb8'; c.font = 'bold 12px sans-serif'; c.textAlign = 'center'; c.fillText('N', 0, -83); c.restore();
  }
  return { drawRotatingMinimap };
}
