# GA Thinking Balls (Neuroevolution Prototype)

![Image](https://github.com/user-attachments/assets/09351e92-fcd5-40f9-83bb-42dd4e0e49b9)
---
![Image](https://github.com/user-attachments/assets/6ab5fd74-e54e-458d-8df7-0267832c3450)

A browser-based simulation where a population of balls learns to navigate an obstacle arena over generations.  
Each ball uses a small neural network and evolves via mutation + selection (genetic algorithm style).

Built with **p5.js** for rendering and **brain.js** for the neural network.

---

## What it does

- Spawns a population of agents (balls)
- Each agent "sees" the world using simple ray-based vision (distance checks)
- A neural network outputs movement decisions (turn / forward / backward)
- Fitness is calculated based on survival + progress toward the finish + vision quality
- The next generation is created by cloning/mutating the top performers

---

## Tech

- JavaScript
- p5.js (canvas + draw loop)
- brain.js (neural network)

---

## How it works (high level)

### Inputs (what the ball sees)
The NN inputs include:
- Vision rays (normalized distances + inverted values)
- Normalized position (x/y)
- Velocity
- Distance traveled

### Outputs (what the ball does)
The NN outputs 4 values used as action triggers:
- turn right
- turn left
- accelerate forward
- accelerate backward

### Evolution loop
- Run simulation for a fixed time (or until all agents fail/succeed)
- Evaluate fitness for each agent
- Keep the top performers
- Clone + mutate to refill the population
- Repeat

---

## Running it

Open the project in a local server (recommended). Example options:
- VS Code “Live Server” extension
- `python -m http.server` (if you have Python installed)

Then open the page in your browser.

---

## Controls / UI

- **Skip / Next Gen button**: forces the next generation early
- **Slider**: adjusts simulation frame rate / speed

---

## Known issues / to-do (note to self)

- Clean up the codebase: split classes into separate files (`Ball`, `Obstacle`, `Population`)
- Remove old commented-out experiments
- Replace magic numbers (angles, weights, arena constants) with config values
- Normalize/verify vision angles (some values look off / inconsistent)
- Make training/evaluation more consistent (currently uses a few hacks for timing + decisions)
- Add a simple README diagram / screenshot of the arena
- Add a `config.js` for all tunables (population size, mutation rate, vision rays, fitness weights)

---
