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
  inputSize: 17,
  outputSize: 4,
  learningRate: 0.3, //default of brainjs, speed it learns
  decayRate: 0.999, //decreases learning rate (get more specific)
  hiddenLayers: [16], //array of ints for the sizes of the hidden layers in the network
  activation: 'sigmoid', //supported activation types: ['sigmoid', 'relu', 'leaky-relu', 'tanh'],
};

/* ── arena dimensions ── */
const arena = {
  cx: canvasW / 2,          //centre x
  cy: canvasH / 2,          //centre y
  w : canvasW - 30,         //width
  h : canvasH / 2           //height
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
    this.accel = .3;
    this.maxSpeed = 10;
    this.success = false;
    this.gameOver = false;
    this.deathBy = null;
    this.angle = 0;      //current facing angle, in radians
    this.angleVel = 0;   //angular velocity (optional)
    this.turnSpeed = .65; //radians per frame
    this.age = 0;
    this.distanceTraveled = 0;
    this.decisionInterval = 150; //millis between decisions
    this.decisionTimer = 0;
    this.output = [0.5, 0.5, 0.5, 0.5]; //neutral default
    this.decisionCooldown = 150 * (60 / frameR8); //higher frame = less frequent decisions

    //const top    = arena.cy - arena.h / 2 + this.r / 2;
    //const bottom = arena.cy + arena.h / 2 - this.r / 2;

    this.brain = new brain.NeuralNetwork(config); //brain of the ball
    //primes the brain so run does not crash
    this.brain.train([{ input: [random(0,1), random(0,1), random(0,1),random(0,1), random(0,1), random(0,1), random(0,1), random(0,1),random(0,1),random(0,1),random(0,1),random(0,1),random(0,1),random(0,1),random(0,1),random(0,1),random(0,1)], output: [random(0,1),random(0,1),random(0,1),random(0,1)] }], { iterations: 1 });

  }
  getDistanceTraveled() {
    return this.distanceTraveled;
  }
  castVision() {
  const maxDist = 100;
  const angles = [-1250, -2500,0,10300, 1250, 2500]; //angles in degrees from facing forward (right)

  let distances = [];

  for (let a of angles) {
    let angleRad = radians(a) + this.angle;  
    let dx = cos(angleRad);
    let dy = sin(angleRad);

    let rayX = this.x;
    let rayY = this.y;
    let distance = 0;
    let hit = false;
    const stepSize = .5;

    while (distance < maxDist && !hit) {
      rayX += dx*stepSize;
      rayY += dy*stepSize;
      distance += stepSize;

      if (rayX < this.r || rayX > arena.w || rayY < 0 || rayY > canvasH) {
        break;
      }

      //check for collision with obstacles
      for (let obs of obstacles) {
        if (obs.collidesWithPoint(rayX, rayY)) {
          hit = true;
          break;
        }
      }
    }
    let normalized = distance / maxDist;
    let inverted = 1 - normalized;
    distances.push(normalized, inverted);
  }
  return distances;
}
drawVision() {
  const angles = [-2500, 0, 10300, 1250, -1250, 2500]; //In degrees
  const maxDist = 300;

  for (let a of angles) {
    let angleRad = radians(a) + this.angle;      //both are in radians
    let dx = cos(angleRad);
    let dy = sin(angleRad);

    let rayX = this.x;
    let rayY = this.y;
    let distance = 0;
    let hit = false;
    const stepSize = .1;

    while (distance < maxDist && !hit) {
      rayX += dx*stepSize;
      rayY += dy*stepSize;
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

//inside drawVision, right after the while-loop
if (hit) {
  push();              //isolate transforms
  resetMatrix();       //back to world coordinates
  fill(255, 0, 0);     //red
  noStroke();
  ellipse(rayX, rayY, 3);
  pop();
}
    //Draw the ray from the ball to the hit point
    //draw the line in world space
    push();
    resetMatrix();
    stroke(0, 50);
    line(this.x, this.y, rayX, rayY);
    pop();
  }
}
  getInputs() {
  return [ //what each ball "sees"
    ...this.castVision(),
    this.x /canvasW, //normalized x coord
    this.y /canvasH, //normalized y coord
    //top / canvasH,
    //bottom / canvasH,
    this.velX / this.maxSpeed,
    this.velY / this.maxSpeed,
    Math.max(0, this.getDistanceTraveled()) / canvasW
    //this.getClosestObstacleDistance()
  ];
}
  draw() {
    push();
    translate(this.x, this.y);
    rotate(this.angle);
    fill(3, 252, 248, 80);
    stroke(0, 0, 0, 127)
    circle(0, 0, this.r);
    //ellipse(0, 0, this.r);
    stroke(0, 50);
    //this.drawVision();
    stroke(1);
    pop();
    if(!this.gameOver) {
      this.age++;
    }
  }
  handleMove() {
    let now = millis();
    let simNow = millis(); //scaled sim time
    if (Math.floor(now) % 2 == 0) {
      this.output = this.brain.run(this.getInputs());
    }

  //Always apply current output, but only update it every few frames
  if (this.output) {
    if (this.output[0] > 0.5) this.angle += this.turnSpeed;
    else if (this.output[1] > 0.5) this.angle -= this.turnSpeed;

    if (this.output[2] > 0.5) {
      this.velX += this.accel * cos(this.angle) * ((frameR8+180) / 240);
      this.velY += this.accel * sin(this.angle) * ((frameR8+180) / 180);
    } else if (this.output[3] > 0.5) {
      this.velX -= this.accel * cos(this.angle) * ((frameR8+180) / 240);
      this.velY -= this.accel * sin(this.angle) * ((frameR8+180) / 240);
    }
  }

  this.velX = constrain(this.velX, -this.maxSpeed, this.maxSpeed);
  this.velY = constrain(this.velY, -this.maxSpeed, this.maxSpeed);
}

applyDamping() { //friction
  let dampFactor =  0.8 * ((frameR8+180) / 240);
  this.velX *= dampFactor;
  this.velY *= dampFactor;

  //if very slow stop
  if (abs(this.velX) < 0.05) this.velX = 0;
  if (abs(this.velY) < 0.05) this.velY = 0;
}
constrainToArena() {
  //math of big rect edges
  const left   = arena.cx - arena.w / 2 + this.r / 2;
  const right  = arena.cx + arena.w / 2 - this.r / 2;
  const top    = arena.cy - arena.h / 2 + this.r / 2;
  const bottom = arena.cy + arena.h / 2 - this.r / 2;

  this.x = constrain(this.x, left,  right);
  this.y = constrain(this.y, top,   bottom);

  if(this.x <= left || this.x >= right || this.y <= top || this.y >= bottom){
    if (this.x >= canvasW/11){
      //this.gameOver = true;
      //numDead += 1;
      this.deathBy = 'wall';
    }
  }
}
loop() { //joins all ball functions, called in draw function
  if(this.gameOver) {
    return; //stop drawing if game ends
  }
  this.draw();
  this.handleMove();
  this.applyDamping();

  this.x += this.velX; //update coords with velocities
  this.y += this.velY;

  this.constrainToArena(); //keep in arena
  if(this.x >= arena.cy*1.7){
  //let winMsg = document.getElementById("win");
  //winMsg.style.display = "block";
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
  const mutationRate = 0.35; //likelihood of mutation

  const mutateWeight = (val) => {
    if (Math.random() < mutationRate) {
      return val + random(-1, 1);
    }
    return val;
  };

  //Deep copy and mutate
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
getClosestObstacleDistance() {
  let minDist = Infinity;

  for (let obs of obstacles) {
    let dx = this.x - obs.x;
    let dy = this.y - obs.y;
    let dist = sqrt(dx * dx + dy * dy); //Euclidean distance
    if (dist < minDist) {
      minDist = dist;
    }
  }

  //Normalize by max possible distance (canvas diagonal)
  let maxDist = sqrt(canvasW * canvasW + canvasH * canvasH);
  return minDist / maxDist; //value between 0 and 1
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
    //First check arena bounds (top/bottom walls)
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
      //rotate into local space
      let angleRad = radians(-this.angle);
      localX = dx * cos(angleRad) - dy * sin(angleRad);
      localY = dx * sin(angleRad) + dy * cos(angleRad);
    } 
    else {
      //no rotation needed
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
  let time = millis()/100;
  push(); //save the current drawing state
  translate(this.x, this.y); //move origin to the obstacle's center
  if(this.rotate){
  rotate(radians(this.angle)); //rotate over time
  }
  if(this.ani){
    this.x += cos(time*3);
    if(this.x >= canvasW/1.35 || this.x <= canvasW/9){
      this.x = canvasW/2;
    }
  }
  rectMode(CENTER); //important to rotate around center
  fill(218, 188, 247);
  strokeWeight(1);
  rect(0, 0, this.w, this.h); //draw at origin (0,0) because we've translated

  pop(); //restore the original drawing state
}
collidesWith(ball) {
  //translate ball into rect space
  let dx = ball.x - this.x;
  let dy = ball.y - this.y;
  
  //rotate ball position in opposite direction of obstacle
  let angleRad = radians(-this.angle); //convert angle to radians
  let localX = dx * cos(angleRad) - dy * sin(angleRad);
  let localY = dx * sin(angleRad) + dy * cos(angleRad);

  //clamp to rectangle bounds
  let closestX = constrain(localX, -this.w / 2, this.w / 2);
  let closestY = constrain(localY, -this.h / 2, this.h / 2);

  //distance from ball center to closest point
  let distX = localX - closestX;
  let distY = localY - closestY;
  let distance = sqrt(distX * distX + distY * distY);

  //if distance < radius, it's a hit
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
      let spawnX = canvasW/11;
      let spawnY = random(arena.cy - arena.h / 2, arena.cy + arena.h /2);
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
  for (let ball of this.balls) {
    const startX = canvasW / 11;
    const endX = arena.cy * 1.7;
    //Use vision quality — how much "free space" the ball sees on average
    const vision = ball.castVision();
    const avgVision = vision.reduce((a, b) => a + b, 0) / vision.length; //add vision rays divide to get avg

    const visionVariance = Math.max(...vision) - Math.min(...vision);
    const distanceTraveled = dist(startX, ball.y, ball.x, ball.y); //only X distance
    ball.distanceTraveled = distanceTraveled;

    //Survival time scaled (reward cautious or strategic behavior)
    const survivalTime = (ball.age / 600); //usually max age ~600 in 10 seconds

    //Directional progress — positive only if going right
    const progress = max(0, (ball.x - startX) / (endX - startX));

    const yCentering = 1 - Math.abs((ball.y - arena.cy) / (arena.h / 2)); //normalized center offset
    ball.fitness += yCentering * 0.25;


    //Base fitness from vision and survival TOTAL FITNESS CAN BE 15
    ball.fitness = 0;
    ball.fitness += survivalTime*2.5;   //survive longer = better

    ball.fitness += avgVision * 2;      //encourage scanning
    ball.fitness += progress*7.5;       //encourage forward progress
    ball.fitness += visionVariance*3; //higher variance = better

    //Success bonus
    if (ball.success) {
      //ball.fitness *= 2;
      ball.fitness += 3; //flat reward for finishing
    }

    //Fail penalties
    if (ball.deathBy === 'obs') {
      let earlyPen = 1 - progress;
      ball.fitness -= 3 * earlyPen;
     } //else if (ball.deathBy === 'wall') {
    //ball.fitness *= 0.5;
    //}

    //Punish lack of movement
    //if (ball.distanceTraveled < 120 || ball.distanceTraveled === 0) {
    //ball.fitness = -1;
    //}
  //const turnRange = (ball.turnHistory && ball.turnHistory.length > 1)
  //? Math.abs(ball.turnHistory.at(-1) - ball.turnHistory.at(0)) : 0;
  //if (turnRange < 10) {
  //ball.fitness *= 0.25; //penalize if they’re not scanning different angles
  //}
    //Punish going backward
    if (ball.x < startX*2) {
      ball.fitness = 0;
    }
  }

  this.best = [...this.balls].sort((a, b) => b.fitness - a.fitness)[0];
}
  nextGen() {
  this.evaluateFitness();

  const newBalls = [];
  const sorted = [...this.balls].sort((a, b) => b.fitness - a.fitness);
  const top25Percent = sorted.slice(0, Math.floor(this.balls.length * 0.25));

  for (let i = 0; i < Math.floor(this.balls.length / 4); i++) {
    //const parent = randomChoice(top50Percent);
    const baby = top25Percent[i].cloneAndMutate();
    newBalls.push(baby);
    //const parent2 = randomChoice(top50Percent);
    const baby2 = top25Percent[i].cloneAndMutate();
    newBalls.push(baby2);
    //const parent = randomChoice(top50Percent);
    const baby3 = top25Percent[i].cloneAndMutate();
    newBalls.push(baby3);
    //const parent2 = randomChoice(top50Percent);
    const baby4 = top25Percent[i].cloneAndMutate();
    newBalls.push(baby4);
  }
    this.balls = newBalls;

  for (let ball of this.balls) {
    ball.fitness = 0;
  }

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


  population = new Population(150); //create population
  //Safe zone properties
  slider = document.getElementById("slider");
  frameR8 = Number(slider.value);


  //ball = new Ball(spawnX, spawnY, 15, false);
  slider = document.getElementById("slider");
  slider.value = 60;
  frameR8 = slider.value;
  slider.value = frameR8;
  //slider.addEventListener("input", () => {
  //frameR8 = Number(slider.value);
  //})
}

function draw() {
  frameR8 = Number(slider.value);
  background(151, 239, 247);
  rectMode(CENTER); //sets rects coords to center
  frameR8 = Number(slider?.value || 60);

  //obstacles[7].x = cos(Math.floor(millis()));

  strokeWeight(1);
  fill(234, 247, 151)
  rect(arena.cy, arena.cx, arena.w, arena.h); //arena

  fill(147, 255, 122);
  strokeWeight(0);
  rect(arena.cy/5-4, arena.cx, arena.w/7, arena.h-1); //safe zone

  fill(218, 188, 247)
  rect(arena.cy*1.814, arena.cx, arena.w/7, arena.h-1) //finish line

  fill(255);
  fill(0);
  text(`Gen: ${population.generation}`, 15, 40);
  text(`|`, 125, 40);
  text(`Seconds Left: ${max(0, secondsLeft.toFixed(1))}`, 141, 40);
  text(`Successes: ${numSuccess}`, 141, 65);
  text(`Fails: ${numDead}`, 15, 65);
  text(`|`, 125, 65);
  text(`|`, 125, 52.5);

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
    population._nextGenScheduled = false;
    genStartTime = millis();
  }
}

  //ball.loop(); //ball

}