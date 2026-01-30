uniform float time;
uniform float uBend;
uniform float uAxis;
varying vec2 vUv;

void main() {
    vUv = uv;
    vec3 newposition = position;

    float distanceFromCenter = 0.0;
    if (uAxis < 0.5) {
        // 横モード (X軸からの距離)
        distanceFromCenter = abs((modelMatrix * vec4(position, 1.0)).x);
    } else {
        // 縦モード (Y軸からの距離)
        distanceFromCenter = abs((modelMatrix * vec4(position, 1.0)).y);
    }

    // newposition.y *= 1.0 + 0.3 * pow(distanceFromCenter, 2.0);
    // newposition.y *= 1.0 + 0.3 * cos(distanceFromCenter * 1.);

    // XZ軸方向（奥行き）にカーブさせる
    newposition.z -= uBend * pow(distanceFromCenter,2.);

    gl_Position = projectionMatrix * modelViewMatrix * vec4(newposition, 1.0);
}