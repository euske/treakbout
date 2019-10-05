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
    '#00ff00','#ff00ff','#00ffff','#ff8800','#0088ff','#ff88ff','#ffff00','#888888',
    '#00ff00','#ff00ff','#00ffff','#ff8800','#0088ff','#ff88ff','#ffff00',
]

//  Paddle
//
class Paddle extends Entity {

    usermove: Vec2;

    constructor(bounds: Rect) {
	super(bounds.anchor('s').move(0,-10));
	let rect = new Rect(-20,-5,40,10);
	this.sprites = [new RectSprite('white', rect)];
	this.collider = rect;
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
	this.v = new Vec2(rnd(2)*8-4, -4);
    }

    onTick() {
        super.onTick();
        let area = this.world.area;
	let bounds = this.getCollider().getAABB();
        let paddle = this.paddle.getCollider().getAABB();
        let v = this.v;
        if (paddle.overlaps(bounds.add(v))) {
            let dx = (paddle.cx() - bounds.cx()) / paddle.width;
            v = new Vec2(-Math.floor(dx*8), -v.y);
        } else {
            let hx = new Vec2(-v.x, v.y);
            let hy = new Vec2(v.x, -v.y);
            let hxy = new Vec2(-v.x, -v.y);
            if (this.movable(bounds, area, v)) {
                ;
            } else if (this.movable(bounds, area, hx)) {
                v = hx;
            } else if (this.movable(bounds, area, hy)) {
                v = hy;
            } else if (this.movable(bounds, area, hxy)) {
                v = hxy;
	    }
        }
        if (this.v !== v) {
	    APP.playSound('beep');
            this.v = v;
        }
	this.pos = this.pos.add(this.v);
    }

    movable(bounds: Rect, area: Rect, v: Vec2) {
        bounds = bounds.add(v);
        if (bounds.x < area.x || area.x1() < bounds.x1()) return false;
        if (bounds.y < area.y) return false;
	let obstacles = this.getObstaclesFor(bounds, v, null);
        return (obstacles.length === 0);
    }

    getObstaclesFor(range: Rect, v: Vec2, context: string): Collider[] {
        return this.world.getEntityColliders(
            (e:Entity) => { return (e instanceof Brick) }, range);
    }
}


//  Brick
//
class Brick extends Entity {

    level = 0;

    constructor(bounds: Rect, color: string) {
	super(new Vec2());
	this.sprites = [new RectSprite(color, bounds)];
	this.collider = bounds;
    }

    isVisible() {
        return 2 <= this.level;
    }

    getCollider(pos: Vec2=null) {
        if (!this.isVisible()) return null;
        return this.collider;
    }
}


//  Game
//
class Game extends GameScene {

    paddle: Paddle;
    ball: Ball;
    bricks: Brick[];

    scoreBox: TextBox;
    score: number;

    onStart() {
        this.world = new World(this.screen.inflate(-4,-8).move(0,8));
        this.world.onStart();
        this.world.window = this.screen;

	this.paddle = new Paddle(this.world.area);
	this.add(this.paddle);
	this.ball = new Ball(this.world.area, this.paddle);
	this.add(this.ball);

        this.bricks = [];
        let bw = 24;
        let x0 = (this.world.area.width - 8*bw)/2 + 4 + 1;
        for (let y = 0; y < 15; y++) {
            let color = COLORS[y];
            for (let x = 0; x < 8; x++) {
                let rect = new Rect(x0+x*bw, 30+y*10, bw-2, 8);
                let brick = new Brick(rect, color);
                if (y == 0) info(x, rect);
                this.add(brick);
                this.bricks.push(brick);
            }
        }

	this.scoreBox = new TextBox(this.screen.move(4,0), FONT);
	this.score = 0;
	this.updateScore();
    }

    onTick() {
	super.onTick();
        let collider = this.ball.getCollider();
        for (let brick of this.bricks) {
            if (collider.overlaps(brick.collider)) {
                if (brick.level == 0) {
                    brick.level = 1;
                }
            } else if (brick.level == 1) {
                brick.level = 2;
                this.score++;
                this.updateScore();
            }
        }
        if (!this.ball.getCollider().overlaps(this.world.area)) {
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
