"use client";

import { useEffect, useRef } from "react";
import { type BlindKind } from "@/lib/game";

interface GbaBackgroundProps {
  blindKind: BlindKind | "shop" | "lost";
  phase?: string;
}

export function GbaBackground({ blindKind, phase }: GbaBackgroundProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Try to get WebGL context
    const gl = canvas.getContext("webgl") || (canvas.getContext("experimental-webgl") as WebGLRenderingContext | null);
    if (!gl) {
      console.warn("WebGL not supported, falling back to static background");
      return;
    }

    // Vertex shader source
    const vsSource = `
      attribute vec2 position;
      void main() {
        gl_Position = vec4(position, 0.0, 1.0);
      }
    `;

    // Fragment shader source (translated exactly from the Unity Shader provided)
    const fsSource = `
      precision mediump float;

      uniform vec2 u_screenSize;
      uniform float u_time;
      uniform vec2 u_offset;
      uniform vec4 u_colour1;
      uniform vec4 u_colour2;
      uniform vec4 u_colour3;
      uniform float u_contrast;
      uniform float u_lighting;
      uniform float u_spinAmount;
      uniform float u_pixelFilter;
      uniform float u_spinRotation;
      uniform float u_spinSpeed;
      uniform float u_spinEase;
      uniform float u_isRotate;

      void main() {
        vec2 screen_coords = gl_FragCoord.xy;
        float pixel_size = length(u_screenSize.xy) / u_pixelFilter;
        vec2 uv = (floor(screen_coords * (1.0 / pixel_size)) * pixel_size - 0.5 * u_screenSize.xy) / length(u_screenSize.xy) - u_offset;
        float uv_len = length(uv);
        
        float speed = (u_spinRotation * u_spinEase * 0.2);
        if (u_isRotate > 0.5) {
          speed = u_time * speed;
        }
        speed += 302.2;

        float new_pixel_angle = atan(uv.y, uv.x) + speed - u_spinEase * 20.0 * (u_spinAmount * uv_len + (1.0 - u_spinAmount));

        vec2 mid = (u_screenSize / length(u_screenSize)) / 2.0;
        uv = vec2(
          uv_len * cos(new_pixel_angle) + mid.x,
          uv_len * sin(new_pixel_angle) + mid.y
        ) - mid;

        uv *= 30.0;
        speed = u_time * u_spinSpeed;

        vec2 uv2 = vec2(uv.x + uv.y, uv.x + uv.y);

        for (int i = 0; i < 5; i++) {
          uv2 += vec2(sin(max(uv.x, uv.y))) + uv;
          uv += 0.5 * vec2(
            cos(5.1123314 + 0.353 * uv2.y + speed * 0.131121),
            sin(uv2.x - 0.113 * speed)
          );
          uv -= vec2(cos(uv.x + uv.y) - sin(uv.x * 0.711 - uv.y));
        }

        float contrast_mod = (0.25 * u_contrast + 0.5 * u_spinAmount + 1.2);
        float paint_res = min(2.0, max(0.0, length(uv) * 0.035 * contrast_mod));

        float c1p = max(0.0, 1.0 - contrast_mod * abs(1.0 - paint_res));
        float c2p = max(0.0, 1.0 - contrast_mod * abs(paint_res));
        float c3p = 1.0 - min(1.0, c1p + c2p);

        float light = (u_lighting - 0.2) * max(c1p * 5.0 - 4.0, 0.0) + u_lighting * max(c2p * 5.0 - 4.0, 0.0);

        vec4 col = (0.3 / u_contrast) * u_colour1 + (1.0 - 0.3 / u_contrast) *
          (u_colour1 * c1p + u_colour2 * c2p + vec4(c3p * u_colour3.rgb, c3p * u_colour1.a)) + vec4(vec3(light), 0.0);

        gl_FragColor = col;
      }
    `;

    // Helper to compile shader
    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile error:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(vsSource, gl.VERTEX_SHADER);
    const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
    if (!vs || !fs) return;

    // Link program
    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error("Program link error:", gl.getProgramInfoLog(program));
      return;
    }

    gl.useProgram(program);

    // Set up vertex buffer for a full-screen quad
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    const positions = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0,
    ]);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const positionLoc = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLoc);
    gl.vertexAttribPointer(positionLoc, 2, gl.FLOAT, false, 0, 0);

    // Get uniform locations
    const uniforms = {
      screenSize: gl.getUniformLocation(program, "u_screenSize"),
      time: gl.getUniformLocation(program, "u_time"),
      offset: gl.getUniformLocation(program, "u_offset"),
      colour1: gl.getUniformLocation(program, "u_colour1"),
      colour2: gl.getUniformLocation(program, "u_colour2"),
      colour3: gl.getUniformLocation(program, "u_colour3"),
      contrast: gl.getUniformLocation(program, "u_contrast"),
      lighting: gl.getUniformLocation(program, "u_lighting"),
      spinAmount: gl.getUniformLocation(program, "u_spinAmount"),
      pixelFilter: gl.getUniformLocation(program, "u_pixelFilter"),
      spinRotation: gl.getUniformLocation(program, "u_spinRotation"),
      spinSpeed: gl.getUniformLocation(program, "u_spinSpeed"),
      spinEase: gl.getUniformLocation(program, "u_spinEase"),
      isRotate: gl.getUniformLocation(program, "u_isRotate"),
    };

    // Synthwave/outrun palettes — retuned from the original GBA set. The swirl
    // math is untouched; only the 3-color palettes change to magenta/cyan/purple/sun.
    const palettes = {
      small: {
        // Magenta / Purple (Synthwave default)
        c1: [1.0, 0.18, 0.53, 1.0],
        c2: [0.69, 0.15, 1.0, 1.0],
        c3: [0.16, 0.05, 0.32, 1.0],
      },
      big: {
        // Sun / Purple (warm amber→violet)
        c1: [1.0, 0.62, 0.17, 1.0],
        c2: [0.69, 0.15, 1.0, 1.0],
        c3: [0.20, 0.08, 0.40, 1.0],
      },
      boss: {
        // Intense red-magenta / crimson (boss threat)
        c1: [1.0, 0.18, 0.18, 1.0],
        c2: [0.69, 0.05, 0.27, 1.0],
        c3: [0.16, 0.02, 0.10, 1.0],
      },
      shop: {
        // Cyan / Purple (calm shop vibe)
        c1: [0.0, 0.94, 1.0, 1.0],
        c2: [0.43, 0.15, 0.78, 1.0],
        c3: [0.05, 0.02, 0.20, 1.0],
      },
      lost: {
        // Somber crimson / charcoal (game over) — kept dark
        c1: [0.45, 0.10, 0.12, 1.0],
        c2: [0.20, 0.03, 0.05, 1.0],
        c3: [0.07, 0.01, 0.02, 1.0],
      },
    };

    // Keep size responsive. Cap drawing buffer resolution for mobile performance.
    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      // Scale down canvas buffer size to 50% for a 75% GPU fill-rate reduction.
      // The browser upscales the low-res buffer to fill parent container, matching the retro pixel theme.
      const scale = 0.5;
      canvas.width = Math.ceil(parent.clientWidth * scale);
      canvas.height = Math.ceil(parent.clientHeight * scale);
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    if (canvas.parentElement) {
      resizeObserver.observe(canvas.parentElement);
    }

    let animationId: number;
    let startTime = Date.now();

    const render = () => {
      if (canvas.width === 0 || canvas.height === 0) {
        animationId = requestAnimationFrame(render);
        return;
      }

      const elapsedSeconds = (Date.now() - startTime) / 1000;
      const palette = palettes[blindKind] || palettes.small;

      gl.useProgram(program);

      // Bind uniforms matching shader defaults
      gl.uniform2f(uniforms.screenSize, canvas.width, canvas.height);
      gl.uniform1f(uniforms.time, elapsedSeconds);
      gl.uniform2f(uniforms.offset, 0.0, 0.0);
      gl.uniform4fv(uniforms.colour1, palette.c1);
      gl.uniform4fv(uniforms.colour2, palette.c2);
      gl.uniform4fv(uniforms.colour3, palette.c3);
      
      // Dynamic parameters based on background type
      let contrast = 2.5;
      let pixelFilter = 1400.0;
      let spinRotation = -0.15;
      let spinSpeed = 0.006;

      if (blindKind === "shop") {
        spinSpeed = 0.003;
        spinRotation = 0.05;
        pixelFilter = 2000.0;
      } else if (blindKind === "lost") {
        spinSpeed = 0.002;
        spinRotation = -0.05;
        pixelFilter = 1000.0;
        contrast = 3.0;
      }
      
      gl.uniform1f(uniforms.contrast, contrast);
      gl.uniform1f(uniforms.lighting, 0.55);
      gl.uniform1f(uniforms.spinAmount, 0.25);
      gl.uniform1f(uniforms.pixelFilter, pixelFilter);
      gl.uniform1f(uniforms.spinRotation, spinRotation);
      gl.uniform1f(uniforms.spinSpeed, spinSpeed);
      gl.uniform1f(uniforms.spinEase, 1.0);
      gl.uniform1f(uniforms.isRotate, 1.0); // Turn rotation on

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      resizeObserver.disconnect();
      cancelAnimationFrame(animationId);
      gl.deleteBuffer(positionBuffer);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, [blindKind]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="absolute inset-0 h-full w-full pointer-events-none"
        style={{
          zIndex: 0,
        }}
      />
      {/* Synthwave CSS overlay (sun + perspective grid + scanlines + CRT flicker).
          Sits IN FRONT of the WebGL swirl (zIndex:1) but BEHIND game content
          (which is z-10+). data-blind drives per-blind color variation. */}
      <div
        className="synthwave-overlay"
        data-blind={blindKind}
        data-phase={phase}
        aria-hidden="true"
        style={{ zIndex: 1 }}
      />
    </>
  );
}
