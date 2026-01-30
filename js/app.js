import * as THREE from "three";
import gsap from "gsap";
import dat from "dat.gui";

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { uniform } from "three/src/nodes/TSL.js";
import fragment from "./shaders/fragment.glsl";
import vertex from "./shaders/vertex.glsl";
const mobile = 786;

export default class Sketch {
    constructor(options) {
        this.container = options.domElement;
        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.camera = new THREE.PerspectiveCamera(70, this.width / this.height, 0.01, 10);
        this.camera.position.z = 1;

        this.scene = new THREE.Scene();
        this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.container.appendChild(this.renderer.domElement);
        // this.controls = new OrbitControls(this.camera, this.renderer.domElement);

        this.time = 0;

        // Scroll navigation setup
        this.margin = 1.2;
        this.scroll = 0;
        this.scrollIndex = 0;
        this.scrollTo = 0;
        this.isAnimating = false;
        this.baseZ = 1;

        this.isKeyDown = false;
        this.keyDirection = 0;
        this.pressStartTime = 0;

        // Canvas Drag
        this.isCanvasDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragScrollStart = 0;

        this.domElement = this.renderer.domElement; // Assuming domElement refers to the canvas
        this.initCanvasEvents();

        this.userInteractionsEnabled = false; // 初期状態では操作不可

        this.resize();
        this.addObjects();
        // this.datSettings();
        this.initProgress(); // プログレスバー初期化
        this.render();
        this.setupResize();
        // this.scrollAnimation(); // ここではまだ呼ばない

        // ローディング完了後（あるいは即時）アニメーション開始
        // 本来はローディング完了イベントを待つべきですが、ここでは即時実行します
        // ローディング完了後（あるいは即時）アニメーション開始
        // 本来はローディング完了イベントを待つべきですが、ここでは即時実行します
        // this.initialCameraAnimation();
    }

    initialCameraAnimation() {
        // Hide UI elements initially
        const pageIndicator = document.querySelector('.page-indicator');
        const headerLinkText = document.querySelector('.header a .link-text');

        if (pageIndicator) pageIndicator.style.opacity = '0';
        if (headerLinkText) headerLinkText.style.opacity = '0';
        // Progress bar is hidden via revealThreshold logic ininitProgress

        // 1/4周分戻った位置からスタート（例: 40枚なら index -10 相当 = 30枚目付近）
        const quarterIndex = Math.round(this.count / 4);

        // スタート位置: プラスのscroll値（＝マイナスのインデックス）
        this.camera.position.z = 4;
        this.scroll = quarterIndex * this.margin;

        // ゴール: 0（1枚目）
        const targetScroll = 0;

        // 3秒かけて 1枚目へ向かう
        gsap.to(this, {
            scroll: targetScroll,
            duration: 3,
            ease: "power2.inOut",
            onComplete: () => {
                // スクロール位置を同期
                this.scrollIndex = 0;
                this.progressRatio = 0; // プログレスバー位置を確実に0にリセット

                this.userInteractionsEnabled = true;
                this.scrollAnimation(); // 操作有効化
                this.updateText(); // テキスト表示

                // ページ番号アニメーション
                if (pageIndicator) {
                    pageIndicator.style.opacity = '0.3';
                    const pageNum = pageIndicator.querySelector('span');
                    if (pageNum) {
                        gsap.fromTo(pageNum,
                            { y: '100%' },
                            { y: '0%', duration: 1, ease: 'power4.out' }
                        );
                    }
                }

                // Instagramリンクのアニメーション
                if (headerLinkText) {
                    headerLinkText.style.opacity = '1';
                    gsap.fromTo(headerLinkText,
                        { y: '100%' },
                        { y: '0%', duration: 1, ease: 'power4.out' }
                    );
                }

                // プログレスバーを左から右へ順に出現させる
                // (revealThresholdを -1 -> barCount へアニメーション)
                if (this.barCount) {
                    this.revealThreshold = -1; // 初期値：全部隠す
                    gsap.fromTo(this,
                        { revealThreshold: -1 },
                        {
                            revealThreshold: this.barCount,
                            duration: 1.0,
                            ease: 'power2.out'
                        }
                    );
                }
            }
        });

        // 同時にカメラも寄っていく
        gsap.to(this.camera.position, {
            z: this.baseZ,
            duration: 3,
            ease: "power2.inOut"
        });
    }

    resize() {
        // const x = (0.20 - 0.11) / (1710 - 1280);

        this.width = this.container.offsetWidth;
        this.height = this.container.offsetHeight;
        this.camera.aspect = this.width / this.height;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.width, this.height);

        // レスポンシブ対応: 1710pxを基準に連続的にカメラ位置を調整
        if (this.width > mobile) {
            this.baseZ = Math.max(1., 1. * (1710 / this.width));
        } else {
            // モバイル
            if (this.width < 500) {
                // 500px未満は、500px時点の見た目（画角）を維持するためにカメラを引く
                // 幅が小さくなる分、Zを大きくする（反比例）
                this.baseZ = 2.0 * (500 / this.width);
            } else {
                // 500px ~ 786px は 2.0 固定
                this.baseZ = 2.2 * (500 / this.width);
            }
        }
        this.camera.position.z = this.baseZ;

        if (this.width > mobile) {
            this.margin = 1.6;
        } else {
            this.margin = 1.2;
        }

        if (this.materials) {
            this.materials.forEach(material => {
                if (material.uniforms.uBend) {
                    // material.uniforms.uBend.value = this.width > 1280 ? 0.06 + (1710 - this.width) * x : 0.06;
                    material.uniforms.uBend.value = 0.06;
                }
                if (material.uniforms.uAxis) {
                    material.uniforms.uAxis.value = this.width > mobile ? 0.0 : 1.0;
                }
            });
        }
    }

    setupResize() {
        window.addEventListener('resize', this.resize.bind(this));
    }

    addObjects() {
        // A4比率 (1 : 1.414)
        this.geometry = new THREE.PlaneGeometry(1.414, 1, 10, 10);
        this.materials = [];
        this.meshes = [];
        this.itemGroups = [];

        const images = [...document.querySelectorAll('.item img')];
        this.textElements = [];
        this.count = images.length;

        // プリロード枚数
        const preloadCount = Math.min(this.count, 5);

        // iframe内の要素を取得
        const iframe = document.getElementById('load');
        let loadingPercent = null;
        if (iframe) {
            // iframeのロードを待つ場合もあるが、同ドメインならアクセス可
            // ただしタイミング次第でnullになるので、try-catchやチェックが必要
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                loadingPercent = doc.getElementById('loading-percent');
            } catch (e) {
                console.warn("Could not access iframe content", e);
            }
        }

        // 1. まず最初の数枚をロード
        const preloadPromises = [];
        for (let i = 0; i < preloadCount; i++) {
            preloadPromises.push(this.loadAndCreateMesh(images[i], i));
        }

        // 進行度表示
        let completed = 0;
        preloadPromises.forEach(p => p.then(() => {
            completed++;
            // Retry fetching the element if it wasn't found initially
            if (!loadingPercent && iframe) {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    loadingPercent = doc.getElementById('loading-percent');
                } catch (e) { }
            }
            if (loadingPercent) loadingPercent.innerText = Math.round((completed / preloadCount) * 100) + '%';
        }));

        Promise.all(preloadPromises).then(() => {
            // 2. 完了 -> アプリ開始（ローディング消去）
            if (iframe) {
                iframe.style.opacity = 0;
                setTimeout(() => {
                    iframe.style.display = 'none';
                }, 500);
            }

            // 重要: 初期スクロールやアニメーションの開始トリガーがあればここで呼ぶ
            // 今回は render loop が既に回っているので、meshが増えれば表示される
            this.initialCameraAnimation();

            // 3. 残りの画像をバックグラウンドで順次ロード
            this.loadRemainingImages(images, preloadCount);
        });
    }

    // 共通のロード＆メッシュ作成処理
    loadAndCreateMesh(img, index) {
        return new Promise((resolve) => {
            new THREE.TextureLoader().load(
                img.src,
                (texture) => {
                    const material = new THREE.ShaderMaterial({
                        uniforms: {
                            time: { value: 0 },
                            uBend: { value: 0.06 },
                            uAxis: { value: this.width > 786 ? 0.0 : 1.0 },
                            uTexture: { value: texture }
                        },
                        side: THREE.DoubleSide,
                        fragmentShader: fragment,
                        vertexShader: vertex,
                        wireframe: false
                    });

                    this.materials[index] = material;

                    let mesh = new THREE.Mesh(this.geometry, material);

                    if (this.width > mobile) {
                        mesh.position.x = (index - (this.count - 1) / 2) * this.margin;
                        mesh.position.y = 0;
                    } else {
                        mesh.position.x = 0;
                        mesh.position.y = (index - (this.count - 1) / 2) * this.margin;
                    }

                    this.scene.add(mesh);
                    this.meshes[index] = mesh;

                    // テキスト要素の関連付け
                    const textEl = img.parentElement.querySelector('.text');
                    this.textElements[index] = textEl;
                    if (textEl) {
                        const targets = textEl.querySelectorAll('.year, .date');
                        targets.forEach(el => this.wrapLettersInSpan(el));
                    }

                    resolve();
                },
                undefined, // onProgress
                (err) => {
                    console.warn(`Failed to load texture for index ${index}: ${img.src}`, err);
                    resolve(); // エラーでも止まらないようにresolveする
                }
            );
        });
    }

    loadRemainingImages(images, startIndex) {
        // 再帰またはループで順次ロード
        const loadNext = (i) => {
            if (i >= images.length) return;
            this.loadAndCreateMesh(images[i], i).then(() => {
                loadNext(i + 1);
            });
        };
        loadNext(startIndex);
    }

    wrapLettersInSpan(element) {
        const text = element.textContent;
        element.innerHTML = text
            .split('')
            .map(char => {
                const content = char === ' ' ? '&nbsp;' : char;
                return `<span class="letter-wrapper"><span class="letter">${content}</span></span>`;
            })
            .join('');
    }

    datSettings() {
        this.settings = {
            uBend: 0.06,
            cameraZ: this.camera.position.z
        };
        this.gui = new dat.GUI();
        this.gui.add(this.settings, "uBend", 0, 1, 0.01).onChange((val) => {
            if (this.materials) {
                this.materials.forEach(m => {
                    m.uniforms.uBend.value = val;
                });
            }
        });

        this.gui.add(this.settings, "cameraZ", 0, 10, 0.01).onChange((val) => {
            this.camera.position.z = val;
            this.baseZ = val;
        }).listen();
    }

    scrollAnimation() {
        // Mouse Wheel
        window.addEventListener('wheel', (e) => {
            this.navigate(Math.sign(e.deltaY));
        });

        // Keyboard
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    handleKeyDown(e) {
        if (!this.userInteractionsEnabled) return;
        if (e.repeat) return;

        const isMobile = this.width <= mobile; // mobile defined as const mobile = 786;

        // Define navigation keys based on device
        // PC: Left/Right = Navigate, Up/Down = Zoom Only
        // Mobile: Up/Down = Navigate, Left/Right = Zoom Only

        let isNavKey = false;
        let isZoomKey = false;
        let direction = 0;

        if (isMobile) {
            // Mobile: Up/Down navigates
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                isNavKey = true;
                direction = (e.key === 'ArrowDown') ? 1 : -1;
            } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
                isZoomKey = true;
            }
        } else {
            // PC: Left/Right navigates
            if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                isNavKey = true;
                // PC: Right is Forward (1), Left is Backward (-1)
                // Note: Original code had Right=1. Assuming correct direction.
                direction = (e.key === 'ArrowRight') ? 1 : -1;
            } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                isZoomKey = true;
            }
        }

        if (isNavKey || isZoomKey) {
            if (this.isKeyDown) return;

            this.isKeyDown = true;
            this.pressStartTime = Date.now();
            this.keyDirection = direction;
            this.isNavKeyActive = isNavKey;

            // タイマーセット: 200ms後に長押しと判定
            this.pressTimer = setTimeout(() => {
                this.isLongPress = true;

                // 長押しの開始: カメラを引く
                this.zoomCamera('longPress');

                // ナビゲーションキーならスクロール開始フラグを立てる
                if (this.isNavKeyActive) {
                    this.isScrollingContinuous = true;
                }
            }, 200);
        }
    }

    handleKeyUp(e) {
        if (['ArrowDown', 'ArrowRight', 'ArrowUp', 'ArrowLeft'].includes(e.key)) {
            // タイマー解除
            if (this.pressTimer) {
                clearTimeout(this.pressTimer);
                this.pressTimer = null;
            }

            this.isKeyDown = false;
            this.isScrollingContinuous = false; // Stop continuous scroll

            if (!this.isLongPress) {
                // Short press
                if (this.isNavKeyActive) {
                    // Navigate single step
                    this.scrollIndex = Math.round(-this.scroll / this.margin);
                    this.navigate(this.keyDirection);
                }
                // ZoomKey short press does nothing specific other than maybe preventing default
            } else {
                // Long press finish: Release
                this.isLongPress = false;

                // Snap to nearest
                this.scrollIndex = Math.round(-this.scroll / this.margin);
                this.animateScroll(this.scrollIndex);
                this.resetCamera();
            }

            this.isNavKeyActive = false;
        }
    }

    updateScrollDuringLongPress() {
        if (this.isScrollingContinuous && this.isLongPress) {
            // Continuous scroll
            const speed = 0.05; // Adjust speed as needed
            this.scroll -= this.keyDirection * speed; // Direction 1 adds index -> decreases scroll (scroll = -index*margin)

            // Note: Since we manipulate this.scroll directly, updateText might not trigger automatically for new indices unless we force it or rely on render loop.
            // But we only update text when camera is reset usually.

            // Sync scrollIndex for reference
            this.scrollIndex = -this.scroll / this.margin;

            // Update pagination real-time
            const rawIdx = Math.round(this.scrollIndex);
            const idx = (rawIdx % this.count + this.count) % this.count;

            const pageNum = document.getElementById('current-page');
            if (pageNum) {
                pageNum.innerText = idx + 1;
            }
        }
    }


    navigate(direction) {
        if (this.isAnimating) return;
        this.isAnimating = true;

        if (direction > 0) {
            this.scrollIndex++;
        } else {
            this.scrollIndex--;
        }

        this.animateScroll(this.scrollIndex);
    }


    updateText(hideOnly = false) {
        // scrollIndexはユーザー操作でどんどん増減するので、0~count-1の範囲に正規化
        const index = (this.scrollIndex % this.count + this.count) % this.count;

        if (this.currentIndex === undefined) this.currentIndex = -1;

        // hideOnlyがtrueのときは強制的に現在表示中のものを消す処理へ進む
        if (!hideOnly && index === this.currentIndex) return;

        const oldText = this.currentIndex !== -1 ? this.textElements[this.currentIndex] : null;
        const newText = this.textElements[index];

        // 1. Safety Cleanup: 他のすべてのテキストを強制リセット（バグ防止）
        // oldText(これから消える) と newText(これから出る) 以外は完全に初期化する
        this.textElements.forEach((el, i) => {
            if (!el) return;
            // hideOnlyの場合は newText は考慮しない
            const isTarget = (i === this.currentIndex) || (!hideOnly && i === index);
            if (!isTarget) {
                // アクティブなまま残っているものがあれば消す
                if (el.classList.contains('active')) {
                    const spans = el.querySelectorAll('.letter');
                    gsap.killTweensOf(spans);
                    el.classList.remove('active');
                    gsap.set(spans, { opacity: 0, y: '100%', yPercent: 0 });
                }
            }
        });

        // 2. 古いテキストのアニメーション（消える）
        if (oldText) {
            const spans = oldText.querySelectorAll('.letter');
            gsap.to(spans, {
                yPercent: -100,
                y: 0,
                opacity: 0, // フェードアウト追加
                stagger: 0.02, // 順次消える
                ease: 'power2.in',
                duration: 0.5,
                overwrite: true, // 強制上書き
                onComplete: () => {
                    oldText.classList.remove('active');
                }
            });
        }

        // hideOnlyならここで終了（新しいテキストは出さない）
        if (hideOnly) {
            this.currentIndex = -1; // リセット
            return;
        }

        // カメラが引いている（Zoom中）なら新しいテキストは出さない
        if (this.isZoomed) return;

        // 3. 新しいテキストのアニメーション
        if (newText) {
            newText.classList.add('active');
            const spans = newText.querySelectorAll('.letter');

            // 初期状態セット
            gsap.killTweensOf(spans);
            gsap.set(spans, {
                y: '100%',
                yPercent: 0,
                opacity: 1
            });

            gsap.to(spans, {
                y: '0%',
                yPercent: 0,
                opacity: 1,
                stagger: 0.02,
                ease: 'power2.out',
                duration: 0.5,
                delay: oldText ? 0.4 : 0.1, // 少し待ってから出現
                overwrite: true
            });
        }

        // Update pagination number
        const pageNum = document.getElementById('current-page');
        if (pageNum) {
            pageNum.innerText = index + 1;
        }

        this.currentIndex = index;
    }

    zoomCamera(mode = 'default') {
        this.isZoomed = true;

        // 1. 現在表示中のテキストのインデックスを退避
        const activeIndex = this.currentIndex;

        // 2. 消去アニメーションを開始（これにより activeIndex の要素が消え始める）
        this.updateText(true);

        // 3. それ以外の要素（特に出現待ちの要素）のアニメーションを完全に殺す
        if (this.textElements) {
            this.textElements.forEach((el, i) => {
                // 今消えている最中の要素は触らない（アニメーション続けさせる）
                if (i === activeIndex && activeIndex !== -1) return;

                if (el) {
                    const spans = el.querySelectorAll('.letter');
                    gsap.killTweensOf(spans); // 出現待ちのアニメーションを殺す
                    el.classList.remove('active');
                    gsap.set(spans, { opacity: 0, y: '100%' });
                }
            });
        }

        this.currentIndex = -1;

        let targetZ;

        if (mode === 'longPress') {
            targetZ = this.width > mobile ? 4.0 : 4.5;
        } else {
            targetZ = this.width > mobile ? 3.0 : 3.5;
        }

        gsap.to(this.camera.position, {
            z: targetZ,
            duration: 1.0,
            ease: 'power4.out'
        });
    }

    resetCamera() {
        gsap.to(this.camera.position, {
            z: this.baseZ,
            duration: 1.0,
            ease: 'power4.out',
            onComplete: () => {
                this.isZoomed = false;
                this.updateText();
            }
        });
    }

    animateScroll(index) {
        if (index === undefined) index = this.scrollIndex;
        const target = -index * this.margin;

        if (!this.isZoomed) {
            this.updateText();
        }

        gsap.to(this, {
            scroll: target,
            duration: 0.5,
            ease: "power4.out",
            onComplete: () => {
                this.isAnimating = false;
            }
        });
    }

    initCanvasEvents() {
        this.isCanvasDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragScrollStart = this.scroll;
        this.dragSpeed = 0.01; // Sensitivity: Higher is faster

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.domElement.addEventListener('mousedown', this.onCanvasDown.bind(this));
        this.domElement.addEventListener('touchstart', this.onCanvasDown.bind(this), { passive: false });
        window.addEventListener('mousemove', this.onCanvasMove.bind(this));
        window.addEventListener('touchmove', this.onCanvasMove.bind(this), { passive: false });
        window.addEventListener('mouseup', this.onCanvasUp.bind(this));
        window.addEventListener('touchend', this.onCanvasUp.bind(this));
    }

    onCanvasDown(e) {
        if (!this.userInteractionsEnabled) return;
        if (e.target.closest('.progress')) return;

        this.isCanvasDragging = true;
        this.isAnimating = false;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        this.dragStart.x = clientX;
        this.dragStart.y = clientY;
        this.dragScrollStart = this.scroll;
        this.isZoomed = false;

        // Camera zoom is now triggered in onCanvasMove
    }

    onCanvasMove(e) {
        if (!this.isCanvasDragging) return;

        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        const deltaX = clientX - this.dragStart.x;
        const deltaY = clientY - this.dragStart.y;

        // Trigger zoom only after movement
        if (!this.isZoomed && Math.hypot(deltaX, deltaY) > 5) {
            this.zoomCamera();
        }

        let moveAmount = 0;

        if (this.width > mobile) {
            moveAmount = deltaX * this.dragSpeed;
        } else {
            moveAmount = deltaY * this.dragSpeed;
        }

        this.scroll = this.dragScrollStart + moveAmount;
    }

    onCanvasUp(e) {
        if (!this.isCanvasDragging) return;
        this.isCanvasDragging = false;

        const clientX = e.changedTouches ? e.changedTouches[0].clientX : e.clientX;
        const clientY = e.changedTouches ? e.changedTouches[0].clientY : e.clientY;
        const dist = Math.hypot(clientX - this.dragStart.x, clientY - this.dragStart.y);

        if (dist < 10 && this.meshes) {
            // Click to navigate
            this.mouse.x = (clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(clientY / window.innerHeight) * 2 + 1;

            this.raycaster.setFromCamera(this.mouse, this.camera);
            const intersects = this.raycaster.intersectObjects(this.meshes);

            if (intersects.length > 0) {
                const obj = intersects[0].object;
                let diff = 0;

                if (this.width > mobile) {
                    if (obj.position.x > this.margin * 0.1) diff = 1;
                    else if (obj.position.x < -this.margin * 0.1) diff = -1;
                } else {
                    if (obj.position.y < -this.margin * 0.1) diff = 1;
                    else if (obj.position.y > this.margin * 0.1) diff = -1;
                }

                if (diff !== 0) {
                    this.scrollIndex += diff;
                    this.animateScroll(this.scrollIndex);
                    // No camera reset needed as zoom wasn't triggered
                    return;
                }
            }
        }

        this.scrollIndex = Math.round(-this.scroll / this.margin);
        this.animateScroll(this.scrollIndex);

        // Reset Camera
        if (this.isZoomed) {
            this.resetCamera();
        }
    }
    initProgress() {
        this.progress = document.querySelector('.progress');
        this.progress.innerHTML = '';
        this.indicators = [];

        this.barCount = window.innerWidth > mobile ? 40 : 40; // モバイルは本数を減らす
        this.revealThreshold = -1; // 初期はすべて隠す（左から出現させるため）

        for (let i = 0; i < this.barCount; i++) {
            const div = document.createElement('div');
            div.classList.add('progress-indicator');
            this.progress.appendChild(div);
            this.indicators.push(div);
        }

        this.isDragging = false;

        // Mouse (Hover interaction)
        this.progress.addEventListener('mouseenter', (e) => this.onPointerDown(e));
        this.progress.addEventListener('mouseleave', () => this.onPointerUp());
        this.progress.addEventListener('mousemove', (e) => this.onPointerMove(e));

        // Touch (Drag interaction)
        this.progress.addEventListener('touchstart', (e) => this.onPointerDown(e.touches[0]));
        window.addEventListener('touchmove', (e) => this.onPointerMove(e.touches[0]));
        window.addEventListener('touchend', () => this.onPointerUp());

        this.progressRatio = 0; // スムージング用
    }

    onPointerDown(e) {
        if (!this.userInteractionsEnabled) return;
        this.isDragging = true;
        this.isAnimating = false; // Allow real-time scroll updates

        // カメラを引く
        this.zoomCamera();

        this.updateDrag(e);
    }

    onPointerMove(e) {
        if (!this.isDragging) return;
        this.updateDrag(e);
    }

    onPointerUp() {
        if (!this.isDragging) return;
        this.isDragging = false;

        // 吸着
        this.scrollIndex = Math.round(-this.scroll / this.margin);
        this.animateScroll(this.scrollIndex);

        // カメラ戻す
        this.resetCamera();
    }

    updateDrag(e) {
        const rect = this.progress.getBoundingClientRect();
        let ratio;

        if (this.width > mobile) {
            ratio = (e.clientX - rect.left) / rect.width;
        } else {
            ratio = (e.clientY - rect.top) / rect.height;
        }

        ratio = Math.max(0, Math.min(1, ratio));

        // 滑らかにスクロール (Math.roundしない)
        const targetIndex = ratio * (this.count - 1);
        this.scroll = -targetIndex * this.margin;

        // barCountに合わせてUI更新
        const barIndex = Math.round(ratio * (this.barCount - 1));
        this.updateProgressUI(barIndex);

        // Update pagination immediately during drag
        const currentIndex = Math.round(targetIndex);
        const pageNum = document.getElementById('current-page');
        if (pageNum) {
            pageNum.innerText = (currentIndex % this.count) + 1;
        }
    }

    updateProgressUI(index) {
        if (!this.indicators) return;

        const count = this.indicators.length;
        const activeSpread = 10;
        const edgeSpread = 8;

        const getGauss = (dist, spread) => {
            if (dist > spread) return 0;
            const sigma = spread / 2.5;
            return Math.exp(- (dist * dist) / (2 * sigma * sigma));
        };

        const getQuad = (dist, spread) => {
            if (dist > spread) return 0;
            return Math.pow(1 - dist / spread, 2);
        };

        this.indicators.forEach((el, i) => {
            // スタイル計算
            const distActive = Math.abs(i - index);
            // 操作可能になるまではハイライト（ホバーエフェクト）を出さない
            const strActive = this.userInteractionsEnabled ? getGauss(distActive, activeSpread) : 0;

            const distStart = Math.abs(i - 0);
            const strStart = getQuad(distStart, edgeSpread);

            const distEnd = Math.abs(i - (count - 1));
            const strEnd = getQuad(distEnd, edgeSpread);

            // 高さ計算
            let scale = 1 + strActive * 0.4;
            scale += strStart * 0.3;
            scale += strEnd * 0.3;

            // 透明度計算
            let opacity = 0.1 + 0.1 * strActive;

            // 出現アニメーション用: revealThresholdより大きいインデックスは隠す
            // (左=小さいインデックス から出現させるため、i <= this.revealThreshold なら表示)
            if (i > this.revealThreshold) {
                opacity = 0;
            }

            if (window.innerWidth > mobile) {
                el.style.transform = `scaleY(${scale})`;
            } else {
                el.style.transform = `scaleX(${scale})`;
                el.style.transformOrigin = 'right center';
            }
            el.style.opacity = opacity;
        });
    }

    FirstToLast() {
        // プログレスバーの同期（常にscroll値に追従）
        // アニメーション中（キー操作/クリック）は即座に反応させるため target(scrollIndex) を使う
        let rawIdx;
        if (this.isAnimating) {
            rawIdx = this.scrollIndex;
        } else {
            rawIdx = -this.scroll / this.margin;
        }

        let idx = (rawIdx % this.count + this.count) % this.count;

        let targetRatio = idx / this.count;
        targetRatio = Math.max(0, Math.min(1, targetRatio));

        // スムージング (70->1 の戻りを表現)
        if (this.progressRatio === undefined) this.progressRatio = targetRatio;

        // 距離が遠い場合（リワインド時など）は速く動かす
        const diff = Math.abs(targetRatio - this.progressRatio);
        const ease = 0.07;

        if (this.isDragging) {
            // Instant update during interaction
            this.progressRatio = targetRatio;
        } else {
            this.progressRatio += (targetRatio - this.progressRatio) * ease;
        }

        const barIndex = Math.round(this.progressRatio * (this.barCount - 1));
        this.updateProgressUI(barIndex);
    }


    render() {
        this.time += 0.05;

        // スクロールの慣性 (競合するため削除)
        // this.scroll += (this.scrollTo - this.scroll) * 0.1;

        // update items
        if (this.materials) {
            this.materials.forEach(m => {
                m.uniforms.time.value = this.time;
            });
        }

        if (this.meshes) {
            const wholeSize = this.count * this.margin;
            const halfSize = wholeSize / 2;

            this.meshes.forEach((mesh, index) => {
                // Calculate position with infinite wrapping
                let rawPos = (index * this.margin) + this.scroll;

                // Wrap position within [-halfSize, halfSize]
                let pos = ((rawPos + halfSize) % wholeSize);
                if (pos < 0) pos += wholeSize;
                pos -= halfSize;

                if (this.width > mobile) {
                    mesh.position.x = pos;
                    mesh.position.y = 0;
                } else {
                    mesh.position.x = 0;
                    mesh.position.y = -pos;
                }
            });
        }

        // update Progress Bar
        this.FirstToLast();


        // update Progress Bar
        this.FirstToLast();

        // Handle Continuous Scroll key press
        this.updateScrollDuringLongPress();


        this.renderer.render(this.scene, this.camera);
        window.requestAnimationFrame(this.render.bind(this));
    }
}


new Sketch({
    domElement: document.getElementById('container')
});