uniform float time;
uniform sampler2D uTexture;
varying vec2 vUv;

void main() {
    // gl_FragColor = vec4(vUv, 0.0, 1.0);
    vec4 textureColor = texture2D(uTexture, vUv);
    gl_FragColor = textureColor;
}