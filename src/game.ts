/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:ImageSpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(16,16), new Vec2(8,8));
});

let COLORS = [
    '#00ff00','#ff00ff','#00ffff','#ff8800','#0088ff','#ff88ff','#ffff00',
]

//  Paddle
//
class Paddle extends Entity {

    dead: Signal;
    usermove: Vec2;

    constructor(bounds: Rect) {
	super(bounds.anchor('s').move(0,-10));
	let rect = new Rect(-15,-5,30,10);
	this.sprites = [new RectSprite('white', rect)];
	this.collider = rect;
        this.dead = new Signal(this);
	this.usermove = new Vec2();
    }

    setMove(v: Vec2) {
	this.usermove.x = v.x * 8;
    }

    onTick() {
        super.onTick();
	this.moveIfPossible(this.usermove);
    }

    getFencesFor(range: Rect, v: Vec2, context: string): Rect[] {
	return [this.world.area];
    }

    onCollided(e:Entity) {
        if (e instanceof Brick) {
            this.stop();
            this.dead.fire();
        }
    }
}


//  Ball
//
class Ball extends Entity {

    paddle: Paddle;
    v: Vec2;

    constructor(bounds: Rect, paddle: Paddle) {
	super(bounds.center());
        this.paddle = paddle;
	let rect = new Rect(-4,-4,8,8);
	this.sprites = [new RectSprite('white', rect)];
	this.collider = rect;
	this.v = new Vec2(rnd(2)*6-3, -3);
    }

    onTick() {
        super.onTick();
        let area = this.world.area;
	let bounds = this.getCollider().getAABB();
        let paddle = this.paddle.getCollider().getAABB();
        let v = this.v;
        if (paddle.overlaps(bounds.add(v))) {
            let dx = (paddle.cx() - bounds.cx()) / paddle.width;
            v = new Vec2(-sign(dx)*Math.floor(dx*4+4), -v.y);
        } else {
            let hx = new Vec2(-v.x, v.y);
            let hy = new Vec2(v.x, -v.y);
            let hxy = new Vec2(-v.x, -v.y);
            let e = this.movable(bounds, area, v);
            if (e === null) {
                ;
            } else {
                if (e instanceof Brick) {
                    (e as Brick).knock();
                }
                e = this.movable(bounds, area, hy);
                if (e === null) {
                    v = hy;
                } else {
                    if (e instanceof Brick) {
                        (e as Brick).knock();
                    }
                    e = this.movable(bounds, area, hx);
                    if (e === null) {
                        v = hx;
                    } else {
                        if (e instanceof Brick) {
                            (e as Brick).knock();
                        }
                        e = this.movable(bounds, area, hxy);
                        if (e === null) {
                            v = hxy;
                        } else {
                            if (e instanceof Brick) {
                                (e as Brick).knock();
                            }
                        }
                    }
                }
	    }
        }
        if (this.v !== v) {
	    APP.playSound('beep');
            this.v = v;
        }
	this.pos = this.pos.add(this.v);
    }

    movable(bounds: Rect, area: Rect, v: Vec2): Entity {
        bounds = bounds.add(v);
        if (bounds.x < area.x || area.x1() < bounds.x1()) return this;
        if (bounds.y < area.y) return this;
	for (let entity of this.world.entities) {
            if (entity === this) continue;
	    if (!entity.isRunning()) continue;
            if (entity instanceof Brick &&
                (entity as Brick).falling) continue;
            let collider = entity.getCollider();
            if (collider === null) continue;
            if (collider.overlaps(bounds)) {
                return entity;
            }
        }
        return null;
    }
}


//  Brick
//
class Brick extends Entity {

    dead: Signal;
    fall: Signal;
    ball: Ball;
    visible = false;
    falling = false;

    constructor(bounds: Rect, color: string, ball: Ball) {
	super(new Vec2());
        this.dead = new Signal(this);
        this.fall = new Signal(this);
        this.ball = ball;
	this.sprites = [new RectSprite(color, bounds)];
	this.collider = bounds;
    }

    onTick() {
        super.onTick();
        if (!this.visible) {
            let ball = this.ball.getCollider().getAABB().inflate(8, 8);
            if (!ball.overlaps(this.collider)) {
                this.visible = true;
            }
        } else if (this.falling) {
            this.pos.y += 4;
            if (!this.getCollider().overlaps(this.world.area)) {
                this.stop();
                this.dead.fire();
            }
        }
    }

    knock() {
        if (!this.falling) {
            this.falling = true;
            this.fall.fire();
	    (this.sprites[0] as RectSprite).color = 'gray';
	    APP.playSound('fall');
        }
    }

    isVisible() {
        return this.visible;
    }

    getCollider(pos: Vec2=null) {
        if (!this.visible) return null;
        return super.getCollider(pos);
    }
}


//  Game
//
class Game extends GameScene {

    paddle: Paddle;
    ball: Ball;
    rects: Rect[];

    scoreBox: TextBox;
    score: number;

    onStart() {
        this.world = new World(this.screen.inflate(-4,-8).move(0,8));
        this.world.onStart();
        this.world.window = this.screen;

	this.paddle = new Paddle(this.world.area);
        this.paddle.dead.subscribe((e:Entity) => {
	    APP.playSound('explosion');
            this.gameOver();
        });
	this.add(this.paddle);
	this.ball = new Ball(this.world.area, this.paddle);
	this.add(this.ball);

        this.rects = [];
        let bw = 24;
        let x0 = (this.world.area.width - 8*bw)/2 + 4 + 1;
        for (let y = 0; y < 12; y++) {
            for (let x = 0; x < 8; x++) {
                let rect = new Rect(x0+x*bw, 30+y*10, bw-2, 8);
                this.rects.push(rect);
            }
        }

	this.scoreBox = new TextBox(this.screen.move(4,0), FONT);
	this.score = 0;
	this.updateScore();
    }

    onTick() {
	super.onTick();
        let collider = this.ball.getCollider();
        for (let i = this.rects.length-1; 0 <= i; i--) {
            let rect = this.rects[i];
            if (collider.overlaps(rect)) {
                let color = choice(COLORS);
                let brick = new Brick(rect, color, this.ball);
                brick.dead.subscribe((e:Entity) => { this.rects.push(rect); });
                brick.fall.subscribe((e:Entity) => {
                    this.score++;
	            this.updateScore();
                });
                this.add(brick);
                this.rects.splice(i, 1);
            }
        }
        if (this.ball.isRunning() &&
            !this.ball.getCollider().overlaps(this.world.area)) {
	    APP.playSound('miss');
            this.ball.stop();
            this.gameOver();
        }
    }

    onDirChanged(v: Vec2) {
	this.paddle.setMove(v);
    }

    onMouseMove(p: Vec2) {
        let v = p.sub(this.paddle.pos);
        if (Math.abs(v.x) < 8) {
            this.paddle.setMove(new Vec2());
        } else {
            this.paddle.setMove(v.sign());
        }
    }

    render(ctx: CanvasRenderingContext2D) {
	ctx.fillStyle = '#ffffff';
	fillRect(ctx, this.world.area.inflate(4,4));
	ctx.fillStyle = '#000000';
	fillRect(ctx, this.world.area.inflate(2,2));
	super.render(ctx);
	this.scoreBox.render(ctx);
    }

    updateScore() {
	this.scoreBox.clear();
	this.scoreBox.putText(['SCORE: '+this.score]);
    }

    gameOver() {
	let banner = new BannerBox(
            this.screen.resize(100,20), FONT, ['GAME OVER!']);
        banner.textbox.background = '#000000';
	this.world.add(banner);
        let task = new Task();
        task.lifetime = 3;
        task.stopped.subscribe(() => { this.reset(); });
        this.world.add(task);
    }
}
