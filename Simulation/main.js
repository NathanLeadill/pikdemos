class Atom {
  constructor (protons, neutrons, electrons) {
    this.protons = protons;
    this.neutrons = neutrons;
    this.electrons = electrons;

    if(electrons == protons) this.neutral = true;
    else this.neutral = false;

  }
}

class Molecules {
  constructor (atoms, bonds) {
    this.atoms = atoms;
    this.bonds = bonds;
  }

  createBond () {

  }
}

class Simulation {
  constructor () {

  }
}


let atom = new Atom(1,2,2);
