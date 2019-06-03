class Graph {
    constructor(nodes, links, mult=0.5, prog=10, pert=10, pnWeights=[1.0,1.0], udWeights=[0.6,0.6]) {
        console.log(mult, pert, prog, pnWeights, udWeights);
        this.mult = mult; // trophic efficiency
        this.prog = prog; // progress of mass movements
        this.pert = -pert; // initial perturbation amount
        this.nodes = new Map(nodes.map((x) => [x.id, x]));
        this.links = links;
        this.isSetup = false;
        this.posnegWeights = pnWeights; // [pos, neg]
        this.updownWeights = udWeights; // [up, down]
    }

    addNode(node) {
        if (!this.nodes.has(node.id)) {
            this.nodes.set(node.id, node);
        }
    }

    addLink(link) {
        if (!this.nodes.has(link.src)
            || !this.nodes.has(link.dst)) {
            throw new Error("src or dst not found in graph");
        }
        else if (link.src == link.dst) {
            throw new Error("no directed links");
        }
        else {
            l = findLink(link);
            if (l) {
                l.count += link.count;
            }
            else {
                this.links.push(link);
            }
        }
    }

    findLink(linkToFind) {
        for (let link of this.links) {
            if (linkToFind.src === link.src && linkToFind.dst === link.dst) {
                return link
            }
        }
    }

    // get links connected to given node id
    // returns [in links, out links]
    getLinks(nodeId) {
        let toRet = [[], []];
        for (let link of this.links) {
            if (link.src == nodeId) {
                toRet[1].push(link);
            } else if (link.dst == nodeId) {
                toRet[0].push(link);
            }
        }
        return toRet;
    }

    // check if graph is a DAG
    // if is not a DAG, returns list of nodes in cycles (if possible)
    detectCycles() {
        let visited = new Set();
        let L = [];
        let self = this;
        let visitFunc = function vis(nodeid) {
            if (!visited.has(nodeid)) {
                visited.add(nodeid);
                for (let outlink of self.getLinks(nodeid)[1]) {
                    vis(outlink.dst);
                }
                L.unshift(nodeid);
            }
        }
        let assigned = new Set();
        let comps = new Map();
        let assignFunc = function ass(nodeid, root) {
            if (!assigned.has(nodeid)) {
                if (!comps.has(root)) {
                    comps.set(root, []);
                } 
                comps.get(root).push(nodeid);
                assigned.add(nodeid);
                
                for (let inlink of self.getLinks(nodeid)[0]) {
                    ass(inlink.src, root);
                }
            }
        }
        for (let node of nodes.keys()) {
            visitFunc(node);
        }
        for (let node of L) {
            assignFunc(node, node);
        }
        let isDAG = true;
        let toRet = new Set();
        for (let comp of comps.values()) {
            if (comp.length > 1) {
                isDAG = false;
                comp.forEach((nodeid) => toRet.add(nodeid));
            }
        }
        if (isDAG) {
            return false;
        } else {
            return toRet;
        }
    }

    // setup calculates trophic levels and determines populations for the graph
    // this should ensure equilibrium of graph if run without modifications after
    setup(auto=true) {
        this.isSetup = true;
        if (auto) { 
            let cycles = this.detectCycles();
            if (cycles) {
                return cycles;
            }
            // there are no cycles. do what's needed
            let q = [];
            let visitedLinks = new Set();
            for (let [nodeid, node] of this.nodes) {
                let ls = this.getLinks(nodeid)[0];
                if (ls.length == 0) {
                    q.push(nodeid);
                }
            }

            let minpop = 1;
            while (q.length > 0) {
                let n = q.shift();

                let [inlinks, outlinks] = this.getLinks(n);
                // get trophic level
                let lvlSum = 0.;
                let lvlNum = 0.;
                for (let inlink of inlinks) {
                    let weight = inlink.count * inlink.weight;
                    lvlNum += weight;
                    lvlSum += weight * (this.nodes.get(inlink.src).lvl + 1);
                }
                if (lvlNum > 0) {
                    this.nodes.get(n).lvl = lvlSum / lvlNum;
                } else {
                    this.nodes.get(n).lvl = 0;
                    lvlNum = 1; // for setting outlink weights
                }
                // set outlink weights
                let lnkCnt = 0;
                for (let outlink of outlinks) {
                    lnkCnt += outlink.count;
                }
                for (let outlink of outlinks) {
                    outlink.weight = this.mult * (lvlNum / lnkCnt);
                }
                // set population
                this.nodes.get(n).pop = lvlNum; // proportional populations
                minpop = Math.min(lvlNum, minpop); 

                for (let outlink of outlinks) {
                    let m = outlink.dst;
                    visitedLinks.add(outlink);
                    
                    let nInlinks = this.getLinks(m)[0];
                    let noIncoming = true;
                    for (let nInlink of nInlinks) {
                        if (!visitedLinks.has(nInlink)) {
                            noIncoming = false;
                            break;
                        }
                    }
                    if (noIncoming) {
                        q.push(m);
                    }
                }
            }
            // convert proportional populations to actual populations
            for (let node of this.nodes.values()) {
                node.pop = Math.round(100 * node.pop / minpop); 
                node.cap = node.pop * 3;
            }
        }
    }

    // setExtinct - species can go extinct without explicit user input
    // ignoreExtinct - species can't increase pop if extinct
    changePop(nodeid, diff, setExtinct=true, ignoreExtinct=true) {
        let node = this.nodes.get(nodeid)
        if (ignoreExtinct && node.isExtinct) {
            return 0;
        }
        let origpop = node.pop
        let cap = node.cap
        let newpop = Math.min(Math.max(0, Math.round(origpop + diff)), cap);
        this.nodes.get(nodeid).pop = newpop;
        this.nodes.get(nodeid).isExtinct = setExtinct && (newpop == 0);
        return newpop - origpop;
    }

    // perturb node by decreasing population by amount
    // ignoreExtinct should be true EXCEPT FOR DIRECT USER INPUTS
    perturb(nodeid, pert, setExtinct=true, ignoreExtinct=true) {
        if (!pert) {
            pert = this.pert;
        }
        let diff = this.changePop(nodeid, pert, setExtinct, ignoreExtinct);
        if (Math.abs(diff) < 1) {
            return;
        }
        // send `diff` split along all edges
        let [inlinks, outlinks] = this.getLinks(nodeid);
        let totInWeight = 0;
        for (let inlink of inlinks) {
            if (ignoreExtinct && this.nodes.get(inlink.src).isExtinct) continue;
            totInWeight += inlink.count * inlink.weight;
        }
        for (let inlink of inlinks) {
            if (ignoreExtinct && this.nodes.get(inlink.src).isExtinct) continue;
            let massToSend = -1 * diff * inlink.count * inlink.weight / totInWeight;
            massToSend *= this.updownWeights[1];
            massToSend /= this.mult;
            if (massToSend > 0) {
                massToSend *= this.posnegWeights[0];
            } else {
                massToSend *= this.posnegWeights[1];
            }
            inlink.fromMasses.push(new LinkMass(massToSend));
        }

        let totOutWeight = 0;
        for (let outlink of outlinks) {
            if (ignoreExtinct && this.nodes.get(outlink.dst).isExtinct) continue;
            totOutWeight += outlink.count * outlink.weight;
        }
        for (let outlink of outlinks) {
            if (ignoreExtinct && this.nodes.get(outlink.dst).isExtinct) continue;
            let massToSend = diff * outlink.count * outlink.weight / totOutWeight;
            massToSend *= this.updownWeights[0];
            massToSend *= this.mult;
            if (massToSend > 0) {
                massToSend *= this.posnegWeights[0];
            } else {
                massToSend *= this.posnegWeights[1];
            }
            outlink.toMasses.push(new LinkMass(massToSend))
        }
    }

    eradicate(nodeid) {
        let nodepop = this.nodes.get(nodeid).pop;
        this.perturb(nodeid, -nodepop, true);
    }

    // tick modifies graph to next state
    tick() {
        if (!this.isSetup) {
            throw new Error("graph needs to be setup");
        }
        // move all masses by prog
        // any above 100 should be aggregated and removed
        let diffs = new Map();
        for (let link of this.links) {
            let toMasses = link.toMasses;
            let fromMasses = link.fromMasses;
            for (let toMass of toMasses) {
                toMass.prog += this.prog;
                if (toMass.prog >= 100) {
                    if (!diffs.has(link.dst)) {
                        diffs.set(link.dst, 0);
                    } 
                    diffs.set(link.dst, diffs.get(link.dst) + toMass.mass);
                }
            }
            for (let fromMass of fromMasses) {
                fromMass.prog += this.prog;
                if (fromMass.prog >= 100) {
                    if (!diffs.has(link.src)) {
                        diffs.set(link.src, 0);
                    }
                    diffs.set(link.src, diffs.get(link.src) + fromMass.mass);
                }
            }
            link.toMasses = toMasses.filter((linkmass) => linkmass.prog < 100);
            link.fromMasses = fromMasses.filter((linkmass) => linkmass.prog < 100);
        }

        for (let [nodeid, diff] of diffs) {
            this.perturb(nodeid, diff)
        }
    }
}

class Node {
    constructor(id, name) {
        this.id = id;
        this.name = name;

        this.lvl = 0; // trophic level
        this.cap = 1000; // population cap
        this.pop = 500; // current population
        this.isExtinct = false; // extinct = no mass goes to that node
    }

    toString() {
        return "id: " + this.id
            + "\tname: " + this.name
            + "\tlvl: " + this.lvl
            + "\tcap: " + this.cap
            + "\tpop: " + this.pop
            + "\tisExtinct: " + this.isExtinct;
    }
}

class Link {
    constructor(src, dst, count=1, weight=1) {
        this.src = src; // source node id
        this.dst = dst; // destination node id
        this.count = count; // # of links for given (src, dst)
        this.weight = weight; // weight of each link
        this.toMasses = []; // masses going to dst
        this.fromMasses = []; // masses coming from dst
    }

    toString() {
        return "src: " + this.src
            + "\tdst: " + this.dst
            + "\tcount: " + this.count
            + "\tweight: " + this.weight
            + "\ttoMasses: [" + this.toMasses + "]"
            + "\tfromMasses: [" + this.fromMasses + "]";
    }
}

class LinkMass {
    constructor(mass) {
        this.mass = mass;
        this.prog = 0; // goes from 0 to 100
    }

    toString() {
        return "(" + this.mass + ", " + this.prog + ")";
    }
}

function generateGraphFromObj(obj) {
    /**
     * obj {
     *  - nodes [
     *    - id
     *    - name
     *    ]
     *  - links [
     *    - src
     *    - dst
     *    - count
     *    ]
     *  - params
     *    - pnWeights
     *    - udWeights
     *    - mult
     * }
     **/

    nodes = [];
    links = [];
    for (n of obj.nodes) {
        nodes.push(new Node(n.id, n.name));
    }
    for (l of obj.links) {
        links.push(new Link(l.src, l.dst, l.count))
    }
    let mult = undefined,
        prog = undefined,
        pert = undefined,
        pnWeights = undefined,
        udWeights = undefined;
    if (obj.params) {
        mult = obj.params.mult ? obj.params.mult : mult;
        prog = obj.params.prog ? obj.params.prog : prog;
        pert = obj.params.pert ? obj.params.pert : pert;
        pnWeights = obj.params.pnWeights ? obj.params.pnWeights : pnWeights;
        udWeights = obj.params.udWeights ? obj.params.udWeights : udWeights;
    }

    return new Graph(nodes, links, mult, prog, pert, pnWeights, udWeights);
}