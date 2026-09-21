/* qw-beams.js — fondo animado de rayos 3D (vanilla JS + Three.js), sin React.
   Puerto directo de la lógica shader del componente "ethereal beams hero":
   mismo ruido Perlin, misma geometría de planos apilados, mismo material
   extendido sobre MeshStandardMaterial. Coloreado con el violeta del tema. */

(function () {
  'use strict';

  if (window.QWBeams) return;

  var NOISE_GLSL = [
    'float random (in vec2 st) {',
    '    return fract(sin(dot(st.xy, vec2(12.9898,78.233)))* 43758.5453123);',
    '}',
    'float noise (in vec2 st) {',
    '    vec2 i = floor(st);',
    '    vec2 f = fract(st);',
    '    float a = random(i);',
    '    float b = random(i + vec2(1.0, 0.0));',
    '    float c = random(i + vec2(0.0, 1.0));',
    '    float d = random(i + vec2(1.0, 1.0));',
    '    vec2 u = f * f * (3.0 - 2.0 * f);',
    '    return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;',
    '}',
    'vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}',
    'vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}',
    'vec3 fade(vec3 t) {return t*t*t*(t*(t*6.0-15.0)+10.0);}',
    'float cnoise(vec3 P){',
    '  vec3 Pi0 = floor(P); vec3 Pi1 = Pi0 + vec3(1.0);',
    '  Pi0 = mod(Pi0, 289.0); Pi1 = mod(Pi1, 289.0);',
    '  vec3 Pf0 = fract(P); vec3 Pf1 = Pf0 - vec3(1.0);',
    '  vec4 ix = vec4(Pi0.x, Pi1.x, Pi0.x, Pi1.x);',
    '  vec4 iy = vec4(Pi0.yy, Pi1.yy);',
    '  vec4 iz0 = Pi0.zzzz; vec4 iz1 = Pi1.zzzz;',
    '  vec4 ixy = permute(permute(ix) + iy);',
    '  vec4 ixy0 = permute(ixy + iz0); vec4 ixy1 = permute(ixy + iz1);',
    '  vec4 gx0 = ixy0 / 7.0;',
    '  vec4 gy0 = fract(floor(gx0) / 7.0) - 0.5;',
    '  gx0 = fract(gx0);',
    '  vec4 gz0 = vec4(0.5) - abs(gx0) - abs(gy0);',
    '  vec4 sz0 = step(gz0, vec4(0.0));',
    '  gx0 -= sz0 * (step(0.0, gx0) - 0.5); gy0 -= sz0 * (step(0.0, gy0) - 0.5);',
    '  vec4 gx1 = ixy1 / 7.0;',
    '  vec4 gy1 = fract(floor(gx1) / 7.0) - 0.5;',
    '  gx1 = fract(gx1);',
    '  vec4 gz1 = vec4(0.5) - abs(gx1) - abs(gy1);',
    '  vec4 sz1 = step(gz1, vec4(0.0));',
    '  gx1 -= sz1 * (step(0.0, gx1) - 0.5); gy1 -= sz1 * (step(0.0, gy1) - 0.5);',
    '  vec3 g000 = vec3(gx0.x,gy0.x,gz0.x); vec3 g100 = vec3(gx0.y,gy0.y,gz0.y);',
    '  vec3 g010 = vec3(gx0.z,gy0.z,gz0.z); vec3 g110 = vec3(gx0.w,gy0.w,gz0.w);',
    '  vec3 g001 = vec3(gx1.x,gy1.x,gz1.x); vec3 g101 = vec3(gx1.y,gy1.y,gz1.y);',
    '  vec3 g011 = vec3(gx1.z,gy1.z,gz1.z); vec3 g111 = vec3(gx1.w,gy1.w,gz1.w);',
    '  vec4 norm0 = taylorInvSqrt(vec4(dot(g000,g000),dot(g010,g010),dot(g100,g100),dot(g110,g110)));',
    '  g000 *= norm0.x; g010 *= norm0.y; g100 *= norm0.z; g110 *= norm0.w;',
    '  vec4 norm1 = taylorInvSqrt(vec4(dot(g001,g001),dot(g011,g011),dot(g101,g101),dot(g111,g111)));',
    '  g001 *= norm1.x; g011 *= norm1.y; g101 *= norm1.z; g111 *= norm1.w;',
    '  float n000 = dot(g000, Pf0); float n100 = dot(g100, vec3(Pf1.x,Pf0.yz));',
    '  float n010 = dot(g010, vec3(Pf0.x,Pf1.y,Pf0.z)); float n110 = dot(g110, vec3(Pf1.xy,Pf0.z));',
    '  float n001 = dot(g001, vec3(Pf0.xy,Pf1.z)); float n101 = dot(g101, vec3(Pf1.x,Pf0.y,Pf1.z));',
    '  float n011 = dot(g011, vec3(Pf0.x,Pf1.yz)); float n111 = dot(g111, Pf1);',
    '  vec3 fade_xyz = fade(Pf0);',
    '  vec4 n_z = mix(vec4(n000,n100,n010,n110),vec4(n001,n101,n011,n111),fade_xyz.z);',
    '  vec2 n_yz = mix(n_z.xy,n_z.zw,fade_xyz.y);',
    '  float n_xyz = mix(n_yz.x,n_yz.y,fade_xyz.x);',
    '  return 2.2 * n_xyz;',
    '}'
  ].join('\n');

  function extendMaterial(THREE, cfg) {
    var physical = THREE.ShaderLib.physical;
    var uniforms = THREE.UniformsUtils.clone(physical.uniforms);
    var defaults = new THREE.MeshStandardMaterial(cfg.material || {});

    if (defaults.color) uniforms.diffuse.value = defaults.color;
    if (uniforms.roughness) uniforms.roughness.value = defaults.roughness;
    if (uniforms.metalness) uniforms.metalness.value = defaults.metalness;
    if (uniforms.envMapIntensity) uniforms.envMapIntensity.value = defaults.envMapIntensity;

    Object.keys(cfg.uniforms || {}).forEach(function (key) {
      var u = cfg.uniforms[key];
      uniforms[key] = (u && typeof u === 'object' && 'value' in u) ? u : { value: u };
    });

    var vert = cfg.header + '\n' + (cfg.vertexHeader || '') + '\n' + physical.vertexShader;
    var frag = cfg.header + '\n' + (cfg.fragmentHeader || '') + '\n' + physical.fragmentShader;

    Object.keys(cfg.vertex || {}).forEach(function (inc) {
      vert = vert.replace(inc, inc + '\n' + cfg.vertex[inc]);
    });
    Object.keys(cfg.fragment || {}).forEach(function (inc) {
      frag = frag.replace(inc, inc + '\n' + cfg.fragment[inc]);
    });

    return new THREE.ShaderMaterial({
      defines: Object.assign({}, physical.defines),
      uniforms: uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      lights: true,
      fog: !!(cfg.material && cfg.material.fog)
    });
  }

  function createStackedPlanesGeometry(THREE, n, width, height, spacing, heightSegments) {
    var geometry = new THREE.BufferGeometry();
    var numVertices = n * (heightSegments + 1) * 2;
    var numFaces = n * heightSegments * 2;
    var positions = new Float32Array(numVertices * 3);
    var indices = new Uint32Array(numFaces * 3);
    var uvs = new Float32Array(numVertices * 2);
    var vertexOffset = 0, indexOffset = 0, uvOffset = 0;
    var totalWidth = n * width + (n - 1) * spacing;
    var xOffsetBase = -totalWidth / 2;

    for (var i = 0; i < n; i++) {
      var xOffset = xOffsetBase + i * (width + spacing);
      var uvXOffset = Math.random() * 300;
      var uvYOffset = Math.random() * 300;

      for (var j = 0; j <= heightSegments; j++) {
        var y = height * (j / heightSegments - 0.5);
        positions.set([xOffset, y, 0, xOffset + width, y, 0], vertexOffset * 3);
        var uvY = j / heightSegments;
        uvs.set([uvXOffset, uvY + uvYOffset, uvXOffset + 1, uvY + uvYOffset], uvOffset);

        if (j < heightSegments) {
          var a = vertexOffset, b = vertexOffset + 1, c = vertexOffset + 2, d = vertexOffset + 3;
          indices.set([a, b, c, c, b, d], indexOffset);
          indexOffset += 6;
        }
        vertexOffset += 2;
        uvOffset += 4;
      }
    }

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));
    geometry.computeVertexNormals();
    return geometry;
  }

  function init(container, opts) {
    var THREE = window.THREE;
    if (!THREE || !container) return null;

    opts = opts || {};
    var beamWidth = opts.beamWidth || 2.5;
    var beamHeight = opts.beamHeight || 18;
    var beamNumber = opts.beamNumber || 10;
    var lightColor = opts.lightColor || '#A855F7';
    var speed = opts.speed || 2.5;
    var noiseIntensity = opts.noiseIntensity || 2;
    var scale = opts.scale || 0.15;
    var rotation = opts.rotation || 43;
    var bgColor = opts.bgColor || '#050508';

    var w = container.clientWidth || 1;
    var h = container.clientHeight || 1;

    var renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
    } catch (e) {
      return null;
    }
    renderer.setPixelRatio(1);
    renderer.setSize(w, h);
    container.appendChild(renderer.domElement);

    var scene = new THREE.Scene();
    scene.background = new THREE.Color(bgColor);

    var camera = new THREE.PerspectiveCamera(30, w / h, 0.1, 100);
    camera.position.set(0, 0, 20);

    var material = extendMaterial(THREE, {
      header:
        '\nvarying vec3 vEye;\nvarying float vNoise;\nvarying vec2 vUv;\nvarying vec3 vPosition;\n' +
        'uniform float time;\nuniform float uSpeed;\nuniform float uNoiseIntensity;\nuniform float uScale;\n' +
        NOISE_GLSL,
      vertexHeader:
        '\nfloat getPos(vec3 pos) {\n' +
        '  vec3 noisePos = vec3(pos.x * 0., pos.y - uv.y, pos.z + time * uSpeed * 3.) * uScale;\n' +
        '  return cnoise(noisePos);\n' +
        '}\n' +
        'vec3 getCurrentPos(vec3 pos) {\n' +
        '  vec3 newpos = pos;\n' +
        '  newpos.z += getPos(pos);\n' +
        '  return newpos;\n' +
        '}\n' +
        'vec3 getNormal(vec3 pos) {\n' +
        '  vec3 curpos = getCurrentPos(pos);\n' +
        '  vec3 nextposX = getCurrentPos(pos + vec3(0.01, 0.0, 0.0));\n' +
        '  vec3 nextposZ = getCurrentPos(pos + vec3(0.0, -0.01, 0.0));\n' +
        '  vec3 tangentX = normalize(nextposX - curpos);\n' +
        '  vec3 tangentZ = normalize(nextposZ - curpos);\n' +
        '  return normalize(cross(tangentZ, tangentX));\n' +
        '}',
      fragmentHeader: '',
      vertex: {
        '#include <begin_vertex>': 'transformed.z += getPos(transformed.xyz);',
        '#include <beginnormal_vertex>': 'objectNormal = getNormal(position.xyz);'
      },
      fragment: {
        '#include <dithering_fragment>':
          '\nfloat randomNoise = noise(gl_FragCoord.xy);\ngl_FragColor.rgb -= randomNoise / 15. * uNoiseIntensity;'
      },
      material: { color: 0x000000, roughness: 0.3, metalness: 0.3, fog: true },
      uniforms: {
        time: { value: 0 },
        uSpeed: { value: speed },
        envMapIntensity: 10,
        uNoiseIntensity: noiseIntensity,
        uScale: scale
      }
    });

    var geometry = createStackedPlanesGeometry(THREE, beamNumber, beamWidth, beamHeight, 0, 100);
    var mesh = new THREE.Mesh(geometry, material);
    var group = new THREE.Group();
    group.rotation.z = (rotation * Math.PI) / 180;
    group.add(mesh);
    scene.add(group);

    var light = new THREE.DirectionalLight(lightColor, 1);
    light.position.set(0, 3, 10);
    scene.add(light);
    scene.add(new THREE.AmbientLight(0xffffff, 1));

    var running = true;
    var clock = new THREE.Clock();
    var rafId = null;

    function tick() {
      if (!running) return;
      rafId = requestAnimationFrame(tick);
      var delta = clock.getDelta();
      material.uniforms.time.value += 0.1 * delta;
      renderer.render(scene, camera);
    }
    tick();

    function onResize() {
      var nw = container.clientWidth || 1;
      var nh = container.clientHeight || 1;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh);
    }
    window.addEventListener('resize', onResize);

    var io = null;
    if ('IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        var wasRunning = running;
        running = entries[0].isIntersecting;
        if (running && !wasRunning) tick();
      }, { threshold: 0 });
      io.observe(container);
    }

    function onVisibility() {
      if (document.hidden) {
        running = false;
      } else {
        running = true;
        tick();
      }
    }
    document.addEventListener('visibilitychange', onVisibility);

    return {
      stop: function () {
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.removeEventListener('resize', onResize);
        document.removeEventListener('visibilitychange', onVisibility);
        if (io) io.disconnect();
        renderer.dispose();
        if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
    };
  }

  window.QWBeams = { init: init };
})();
