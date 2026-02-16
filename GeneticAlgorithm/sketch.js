//skip button
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("win").addEventListener("click", () => {
    population.nextGen();
    genStartTime = millis();
  });
});

let canvasH = 600;
let canvasW = 600;

let obstacles = [];
let population;

let genStartTime = 0;
let numDead = 0;
let numSuccess = 0;
let frameR8 = 60;
let secondsLeft = 10;
let slider;

const config = { //used to config brain
  inputSize: 16, // CHANGED: Reduced from 17 to 15 (5 vision rays * 2 + 5 internal states)
  outputSize: 4,
  learningRate: 0.5, 
  decayRate: 0.999, 
  hiddenLayers: [24, 12, 6], 
  activation: 'sigmoid', 
};

/* ── arena dimensions ── */
const arena = {
  cx: canvasW / 2,          // centre x
  cy: canvasH / 2,          // centre y
  w : canvasW - 30,         // width
  h : canvasH / 2           // height
};

class Ball {
  constructor (x, y, r, isPlayer) {
    this.isPlayer = isPlayer;
    this.x = x;
    this.y = y;
    this.r = r;
    this.fitness = 0;
    this.velX = 0;
    this.velY = 0;
    this.accel = 0.5;
    this.maxSpeed = 5;
    this.success = false;
    this.gameOver = false;
    this.deathBy = null;
    this.angle = 0;      // current facing angle, in radians
    this.turnSpeed = 0.65; // radians per frame
    this.age = 0;
    this.distanceTraveled = 0;
    this.output = [0.5, 0.5, 0.5, 0.5]; // neutral default

    this.brain = new brain.NeuralNetwork(config); 
    
    // Primes the brain so run does not crash (dynamically sized based on config)
    const dummyInputs = Array.from({length: config.inputSize}, () => random(0, 1));
    this.brain.train([{ input: dummyInputs, output: [0.5, 0.5, 0.5, 0.5] }], { iterations: 1 });
  }

  getDistanceTraveled() {
    return this.distanceTraveled;
  }

  castVision() {
    const maxDist = 200;
    // FIX 1: Clean, symmetrical sensor sweep (-60, -30, 0, 30, 60 degrees)
    const angles = [-60, -30, 0, 30, 60]; 

    let distances = [];

    for (let a of angles) {
      let angleRad = radians(a) + this.angle;  
      // Using Math.cos/sin to strictly enforce radians regardless of p5's angleMode
      let dx = Math.cos(angleRad);
      let dy = Math.sin(angleRad);

      let rayX = this.x;
      let rayY = this.y;
      let distance = 0;
      let hit = false;
      const stepSize = 0.5;

      while (distance < maxDist && !hit) {
        rayX += dx * stepSize;
        rayY += dy * stepSize;
        distance += stepSize;

        if (rayX < this.r || rayX > arena.w || rayY < 0 || rayY > canvasH) {
          break;
        }

        for (let obs of obstacles) {
          if (obs.collidesWithPoint(rayX, rayY)) {
            hit = true;
            break;
          }
        }
      }
      
      let normalized = distance / maxDist;
      let danger = Math.pow(1 - normalized, 2);
      distances.push(normalized, danger);
    }
    return distances;
  }

  drawVision() {
    // Optional: Update this to match castVision if you decide to uncomment it in draw()
    const angles = [-60, -30, 0, 30, 60]; 
    const maxDist = 100;
    /* ... keeping implementation brief as it is currently commented out in render ... */
  }

  getInputs() {
    return [ //what each ball "sees"
      ...this.castVision(),
      this.x / canvasW, //normalized x coord
      this.y / canvasH, //normalized y coord
      this.velX / this.maxSpeed,
      this.velY / this.maxSpeed,
      this.angle / 360,
      Math.max(0, this.getDistanceTraveled()) / canvasW
    ];
  }

  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    fill(3, 252, 248, 80);
    stroke(0, 0, 0, 127);
    circle(0, 0, this.r);
    stroke(0, 50);
    //this.drawVision();
    stroke(1);
    pop();
    if(!this.gameOver) {
      this.age++;
    }
  }

handleMove() {
  this.output = this.brain.run(this.getInputs());

  // CONFIDENCE THRESHOLDS
  const moveThreshold = 0.7; 
  const steerThreshold = 0.5; // Lower threshold so they are ALWAYS trying to aim
  const jumpPower = 2.0; 
  
  if (this.output) {
    // Left/Right Rotation (Aiming)
    if (this.output[0] > steerThreshold) this.angle += 8;
    if (this.output[1] > steerThreshold) this.angle -= 8;

    // Forward/Backward Bursts
    if (this.output[2] > moveThreshold) {
      this.velX += Math.cos(this.angle) * jumpPower;
      this.velY += Math.sin(this.angle) * jumpPower;
    }
    // Backward burst helps them "back away" from a wall they see
    if (this.output[3] > moveThreshold) {
      this.velX -= Math.cos(this.angle) * jumpPower;
      this.velY -= Math.sin(this.angle) * jumpPower;
    }
  }

  this.velX = constrain(this.velX, -this.maxSpeed, this.maxSpeed);
  this.velY = constrain(this.velY, -this.maxSpeed, this.maxSpeed);
}

applyDamping() {
  // Very high friction - they should almost stop between "jumps"
  let dampFactor = 0.85; 
  this.velX *= dampFactor;
  this.velY *= dampFactor;
}

  constrainToArena() {
    const left   = arena.cx - arena.w / 2 + this.r / 2;
    const right  = arena.cx + arena.w / 2 - this.r / 2;
    const top    = arena.cy - arena.h / 2 + this.r / 2;
    const bottom = arena.cy + arena.h / 2 - this.r / 2;

    this.x = constrain(this.x, left, right);
    this.y = constrain(this.y, top, bottom);

    if(this.x <= left || this.x >= right || this.y <= top || this.y >= bottom){
      if (this.x >= canvasW / 11){
        this.deathBy = 'wall';
      }
    }
  }

  loop() { //joins all ball functions
    if(this.gameOver) return;
    
    this.draw();
    this.handleMove();
    this.applyDamping();

    this.x += this.velX;
    this.y += this.velY;

    this.constrainToArena(); 
    if(this.x >= arena.cy * 1.7){
       this.success = true;
       ++numSuccess;
    }
  }

  cloneAndMutate() {
    const clone = new Ball(canvasW / 11, random(arena.cy - arena.h / 2, arena.cy + arena.h / 2), this.r, false);
    const brainJSON = this.brain.toJSON();
    clone.brain.fromJSON(this.mutate(brainJSON));
    return clone;
  }

  mutate(brainJSON) {
    // FIX 2: Lowered mutation rate and magnitude
    const mutationRate = 0.05; 

    const mutateWeight = (val) => {
      if (Math.random() < mutationRate) {
        // Only tweak the weight slightly, don't completely overwrite it
        return val + random(-0.1, 0.1);
      }
      return val;
    };

    for (let layer in brainJSON.layers) {
      for (let node in brainJSON.layers[layer]) {
        const nodeObj = brainJSON.layers[layer][node];
        if (nodeObj.weights) {
          for (let weight in nodeObj.weights) {
            nodeObj.weights[weight] = mutateWeight(nodeObj.weights[weight]);
          }
        }
        if (nodeObj.bias) {
          nodeObj.bias = mutateWeight(nodeObj.bias);
        }
      }
    }
    return brainJSON;
  }
}

class Obstacle {
  constructor(x, y, w, h, rotate, ani, tri) {
    this.x = x;
    this.y = y;
    this.w = w;
    this.h = h;
    this.angle = 0;
    this.rotate = rotate;
    this.ani = ani;
  }

  collidesWithPoint(px, py) {
    const topWallY = arena.cy - arena.h / 2;
    const bottomWallY = arena.cy + arena.h / 2;

    if ((py <= topWallY || py >= bottomWallY) && px >= arena.cx - arena.w / 2 && px <= arena.cx + arena.w / 2) {
      return true;
    }
    
    let dx = px - this.x;
    let dy = py - this.y;
    let localX;
    let localY;

    if (this.rotate) {
      let angleRad = radians(-this.angle);
      localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
      localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);
    } else {
      localX = dx;
      localY = dy;
    }
    return (
      localX >= -this.w / 2 &&
      localX <= this.w / 2 &&
      localY >= -this.h / 2 &&
      localY <= this.h / 2
    );
  }

  update() {
    if(this.rotate){
      this.angle += random(25, 150);
    }
  }

  draw() {
    let time = millis() / 100;
    push(); 
    translate(this.x, this.y); 
    if(this.rotate){
      rotate(radians(this.angle)); 
    }
    if(this.ani){
      this.x += Math.cos(time * 3);
      if(this.x >= canvasW / 1.35 || this.x <= canvasW / 9){
        this.x = canvasW / 2;
      }
    }
    rectMode(CENTER); 
    fill(218, 188, 247);
    strokeWeight(1);
    rect(0, 0, this.w, this.h); 
    pop(); 
  }

  collidesWith(ball) {
    let dx = ball.x - this.x;
    let dy = ball.y - this.y;
    
    let angleRad = radians(-this.angle); 
    let localX = dx * Math.cos(angleRad) - dy * Math.sin(angleRad);
    let localY = dx * Math.sin(angleRad) + dy * Math.cos(angleRad);

    let closestX = constrain(localX, -this.w / 2, this.w / 2);
    let closestY = constrain(localY, -this.h / 2, this.h / 2);

    let distX = localX - closestX;
    let distY = localY - closestY;
    let distance = Math.sqrt(distX * distX + distY * distY);

    return distance < ball.r / 2;
  }
}

class Population {
  constructor(size) {
    this.balls = [];
    this.generation = 0;
    this.best = null;
    this._nextGenScheduled = false;

    for (let i = 0; i < size; i++) {
      let spawnX = canvasW / 11;
      let spawnY = random(arena.cy - arena.h / 2, arena.cy + arena.h / 2);
      this.balls.push(new Ball(spawnX, spawnY, 15, false));
    }
  }

  update() {
    for (let ball of this.balls) {
      if(!ball.success && !ball.gameOver) {
        ball.loop();
      }
    }
  }

evaluateFitness() {
  const startX = canvasW / 11;
  const finishX = arena.cy * 1.7;         // The x-coordinate where they win
  const maxProgress = finishX - startX;  // Theoretical max distance
  const maxAge = 10 * 60;                // 10 seconds at 60fps = 600 frames

  for (let ball of this.balls) {
    // 1. Calculate Raw Components
    let progress = constrain(ball.x - startX, 0, maxProgress);
    let age = constrain(ball.age, 0, maxAge);

    // 2. Normalize both to a 0.0 - 1.0 scale
    let normProgress = progress / maxProgress;
    let normSurvival = age / maxAge;

    // 3. Combine them for a base score out of 1000
    // (normProgress * 500) + (normSurvival * 500) = 1000 max
    ball.fitness = (normProgress * 500) + (normSurvival * 400);

    // 4. Lateral Exploration Bonus (Small Nudge)
    // Adds up to 50 extra points for moving up/down to encourage dodging
    let verticalDeviation = abs(ball.y - arena.cy);
    ball.fitness += (verticalDeviation / (arena.h / 2)) * 50;

    // 5. Apply Penalties (The "Filter")
    // Hitting an obstacle is a 95% reduction
    if (ball.deathBy === 'obs') {
      ball.fitness *= 0.5; 
    }
    
    // Staying at the start is a 95% reduction
    if (progress < 5) {
      ball.fitness *= 0.05; 
    }

    // 6. Success Bonus
    // We keep this massive so that ANY winner is mathematically 
    // superior to the best "loser."
    if (ball.success) {
      ball.fitness += 1000000;
    }
  }

  // Sort the population to identify the best performer for elitism
  this.best = [...this.balls].sort((a, b) => b.fitness - a.fitness)[0];
}

  nextGen() {
    this.evaluateFitness();

    const newBalls = [];
    const sorted = [...this.balls].sort((a, b) => b.fitness - a.fitness);
    
    // FIX 2 (Part 2): Elitism - Push the absolute best performer completely untouched
    const elite = new Ball(canvasW / 11, random(arena.cy - arena.h / 2, arena.cy + arena.h / 2), 15, false);
    elite.brain.fromJSON(this.best.brain.toJSON());
    newBalls.push(elite);

    // Fill the rest of the generation using the top 25%
    const top25Percent = sorted.slice(0, Math.max(1, Math.floor(this.balls.length * 0.25)));

    while (newBalls.length < this.balls.length) {
      let parent = randomChoice(top25Percent);
      newBalls.push(parent.cloneAndMutate());
    }

    this.balls = newBalls;
    this.generation++;
    numSuccess = 0;
    numDead = 0;
  }
}

function random(min, max) {
  return Math.random() * (max - min) + min;
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function setup() {
  createCanvas(canvasW, canvasH);
  angleMode(DEGREES);
  textFont('monospace');
  textSize(20);
  genStartTime = millis();

  obstacles.push(new Obstacle(200, canvasH / 2.7, 130, 10, true));
  obstacles.push(new Obstacle(400, canvasH / 2.7, 130, 10, true));
  obstacles.push(new Obstacle(200, canvasH /1.7, 130, 10, true));
  obstacles.push(new Obstacle(400, canvasH /1.7, 130, 10, true));
  obstacles.push(new Obstacle(300, canvasH /1.365, 10, 20, false, true));
  obstacles.push(new Obstacle(300, canvasH /3.75, 10, 20, false, true));
  obstacles.push(new Obstacle(canvasW/5.85, canvasH /1.455, 10, 75));
  obstacles.push(new Obstacle(canvasW/5.85, canvasH /3.2, 10, 75));
  obstacles.push(new Obstacle(canvasW/2, canvasH /2, 10, 70));
  obstacles.push(new Obstacle(canvasW/1.96, canvasH / 3.98, arena.w*4.85/7, 1/10));
  obstacles.push(new Obstacle(canvasW/1.96, canvasH / 1.335, arena.w*4.85/7, 1/10));

  population = new Population(150); 
  
  slider = document.getElementById("slider");
  if(slider) {
    slider.value = 60;
    frameR8 = slider.value;
  }
}

function draw() {
  if (slider) frameR8 = Number(slider.value);
  
  background(151, 239, 247);
  rectMode(CENTER); 
  
  strokeWeight(1);
  fill(234, 247, 151);
  rect(arena.cy, arena.cx, arena.w, arena.h); //arena

  fill(147, 255, 122);
  strokeWeight(0);
  rect(arena.cy/5-4, arena.cx, arena.w/7, arena.h-1); //safe zone

  fill(218, 188, 247);
  rect(arena.cy*1.814, arena.cx, arena.w/7, arena.h-1); //finish line

  fill(0);
  text(`Gen: ${population.generation}`, 15, 40);
  text(`|`, 115, 40);
  text(`Seconds Left: ${max(0, secondsLeft.toFixed(1))}`, 141, 40);
  text(`Successes: ${numSuccess}`, 141, 65);
  text(`Fails: ${numDead}`, 15, 65);
  text(`|`, 115, 65);
  text(`|`, 115, 52.5);

  obstacles.forEach(obstacle => {
    fill(151, 239, 247);
    strokeWeight(1);
    for(let ball of population.balls){
      if(!ball.success && !ball.gameOver && obstacle.collidesWith(ball)) {
        ball.gameOver = true;
        numDead += 1;
        ball.deathBy = 'obs';
      }
    }
    obstacle.draw();
    obstacle.update();
  });

  population.update();

  const allDone = population.balls.every(ball => ball.gameOver || ball.success);

  let secondsElapsed = ((millis() - genStartTime) / 1000) * (frameR8 / 60);
  secondsLeft = max(0, 10 - secondsElapsed);

  if (!population._nextGenScheduled && ((secondsElapsed >= 10) || allDone)) {
    population._nextGenScheduled = true;
    try {
      population.nextGen();
      population._nextGenScheduled = false;
      genStartTime = millis();
    } catch (e) {
      console.error(e);
      population._nextGenScheduled = false;
      genStartTime = millis();
    }
  }
}