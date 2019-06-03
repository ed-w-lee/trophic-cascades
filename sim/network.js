var svg_w = 600;
var svg_h = 600;
var playing = false;
var selectedNode = 0;

// gets XY for each node in graph
function autoCalcXY(graph, w, h) {
    let maxlvl = 0;
    let lvlcounts = new Map();
    let lvlidx = new Map();
    for (let node of graph.nodes.values()) {
        maxlvl = Math.max(node.lvl, maxlvl);
        if (!lvlcounts.has(node.lvl)) {
            lvlcounts.set(node.lvl, 0);
            lvlidx.set(node.id, 0);
        }
        let cnt = lvlcounts.get(node.lvl);
        lvlcounts.set(node.lvl, cnt + 1);
        lvlidx.set(node.id, cnt);
    }
    let x = new Map(),
        y = new Map();
    let a = 0, b = 0;
    if (w > h) {
        a = svg_w;
        b = svg_h;
    } else {
        a = svg_h;
        b = svg_w;
    }
    let x_tmp = d3.scalePow()
        .exponent(2/3)
        .domain([0, maxlvl])
        .range([0.15 * a, .85 * a]);
    for (let [nodeid, node] of graph.nodes) {
        x.set(nodeid, x_tmp(node.lvl));
        node_lvlidx = lvlidx.get(nodeid);
        node_lvlcnt = lvlcounts.get(node.lvl);
        let y_val = (node_lvlidx + 1) * b / (node_lvlcnt + 1);
        y.set(nodeid, y_val)
    }
    if (w > h) {
        return [x, y];
    } else {
        let newX = new Map();
        for (let [nid, x_val] of x) {
            newX.set(nid, a - x_val);
        }
        return [y, newX];
    }
}

function layout(graph) {
    let svg = d3.select('svg')
        .attr('width', '100%')
        .attr('height', '400px');
    svg.append('g')
        .attr('id', 'nodes');
    svg.append('g')
        .attr('id', 'links');
    svg.append('g')
        .attr('id', 'names');
    let dims = svg.node().getBoundingClientRect();
    var positions = autoCalcXY(graph, dims.width, dims.height);

    d3.select("#play-btn").on('click', () => {
        if (playing) {
            clearInterval(playing);
            playing = false;
            d3.select('#play-btn').text("play");
        } else {
            playing = window.setInterval(() => {
                graph.tick();
                render(graph, positions);
            }, 50);
            d3.select('#play-btn').text("pause");
        }
    });
    d3.select("#perturb-btn").on('click', () => {
        graph.perturb(selectedNode, undefined, setExtinct = true, ignoreExtinct = true);
        render(graph, positions);
    });
    d3.select('#extinct-btn').on('click', () => {
        graph.eradicate(selectedNode);
        render(graph, positions);
    });

    return positions;
}

// should return needed arcs for given link
function arcPath(link, positions, idx, lineGen) {
    let dist = 100;
    let x1 = positions[0].get(link.src),
        y1 = positions[1].get(link.src),
        x2 = positions[0].get(link.dst),
        y2 = positions[1].get(link.dst);

    let dx = (x2-x1),
        dy = (y2-y1),
        hype = Math.sqrt((x1-x2)**2 + (y1-y2)**2),
        midx = (x1 + x2) / 2,
        midy = (y1 + y2) / 2;

    let i = Math.floor(idx / 2) + 1 / 2
    if (idx % 2 == 0) {
        let cx = midx + dx * i * dist / hype,
            cy = midy - dy * i * dist / hype;
        return lineGen([[x1, y1], [cx, cy], [x2, y2]]);
    } else {
        let cx = midx - dx * i * dist / hype,
            cy = midy + dy * i * dist / hype;
        return lineGen([[x1, y1], [cx, cy], [x2, y2]]);
    }
}

function getProgAlong(path, progress) {
    let l = path.getTotalLength();
    let p = path.getPointAtLength(l * progress / 100);
    return "translate(" + p.x + ',' + p.y + ")";
}

function getSize(mass, isUp) {
    let initR = Math.log2(Math.abs(mass.mass)) + 10;
    if (isUp) {
        initR *= (200 - mass.prog) / 100;
    } else {
        initR *= (mass.prog + 100) / 200;
    }
    return initR;
}

function render(graph, positions) {
    let nodes = Array.from(graph.nodes.values());
    let nSelect = d3.select('#nodes')
        .selectAll('g')
        .data(nodes);
    let nEnter = nSelect
        .enter()
        .append('g');
    nEnter.append('circle')
        .attr('class', 'pop');
    nEnter.append('circle')
        .attr('class', 'cap');
    nEnter.append('circle')
        .attr('class', 'click');
    nSelect.exit().remove();

    ng = d3.selectAll('#nodes > g')
        .data(nodes);
    ng.attr('transform', (d, i) => {
        let posX = positions[0].get(d.id),
            posY = positions[1].get(d.id);
        return 'translate(' + posX + ',' + posY + ')';
    })
        .attr('filter', (d) => (d.id == selectedNode) ? "url(#f4)" : "");
    let maxlvl = 0;
    for (let n of nodes) {
        maxlvl = Math.max(maxlvl, n.lvl);
    }
    ncap = d3.selectAll('#nodes > g > circle.cap')
        .data(nodes)
        .transition()
        .attr('r', (d, i) => 6 * Math.sqrt(d.cap) / (maxlvl))
        .attr('fill', 'transparent')
        .attr('stroke', 'darkred')
        .attr('stroke-width', 5);
    npop = d3.selectAll('#nodes > g > circle.pop')
        .data(nodes)
        .transition()
        .attr('r', (d, i) => 6 * Math.sqrt(d.cap) / (maxlvl) * (d.pop / d.cap))
        .attr('fill', 'darkred');
    let getLine = function(d) {
        r = 4 * Math.sqrt(d.cap) / (maxlvl) * (d.pop / d.cap);
        k = 0.8;
        if (Math.abs(d.pop - d.cap/2) < 10) {
            return [0,0,0,0]
        } else if (d.pop > d.cap/2) {
            return [0, -k*r, 0, k*r];
        } else {
            return [0, k*r, 0, -k*r]
        }
    }
    nclick = d3.selectAll('#nodes > g > circle.click')
        .data(nodes)
        .on('click', (d) => {
            console.log('selected: ', d.id)
            selectedNode = d.id;
            render(graph, positions);
        })
        .transition()
        .attr('r', (d, i) => 6 * Math.sqrt(d.cap) / (maxlvl) + 20)

    let links = graph.links;
    let lSelect = d3.select('#links')
        .selectAll('g.link')
        .data(links);
    lSelect.enter()
        .append((d) => {
            link = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            link.setAttribute('class', 'link');
            for (let i of Array(d.count).keys()) {
                path = document.createElementNS('http://www.w3.org/2000/svg', 'g');
                path.setAttribute('class', 'path');
                path.appendChild(document.createElementNS('http://www.w3.org/2000/svg', 'path'));
                link.appendChild(path);
            }
            return link;
        });
    lSelect.exit().remove();

    let lineGen = d3.line()
        .x((d) => d[0])
        .y((d) => d[1])
        .curve(d3.curveBasis);
    let lpos = d3.selectAll('#links > g.link')
        .data(links)
        .selectAll('path')
        .data((d) => {
            return Array(d.count).fill(d);
        });
    lpos.attr('d', (d, i, g) => arcPath(d, positions, i, lineGen))
        .attr('stroke', 'darkred')
        .attr('stroke-width', 3)
        .attr('fill', 'transparent');

    let expandedLinks = [];
    for (let link of links) {
        for (let i = 0; i < link.count; i++) {
            expandedLinks.push([i, link]);
        }
    }
    let lto = d3.selectAll('#links > g.link > g.path')
        .data(expandedLinks)
        .selectAll('circle.tomass')
        .data((d) => {
            currMass = [];
            for (mass of d[1].toMasses) {
                currMass.push([d[0], d[1], mass])
            }
            return currMass;
        })
    let ltoEnter = lto.enter()
        .append('circle')
            .attr('class', 'tomass');
    lto.exit().remove();
    lto.merge(ltoEnter)
        .attr('r', (d) => getSize(d[2], true))
        .attr('fill', (d) => d[2].mass > 0 ? "green" : "red")
        .attr('transform', (d,i,g) => {
            // lmao; hella sketch :p
            path = g[i].parentElement.getElementsByTagName('path')[0]
            return getProgAlong(path, d[2].prog);
        })
    let lfrom = d3.selectAll('#links > g.link > g.path')
        .data(expandedLinks)
        .selectAll('circle.frommass')
        .data((d) => {
            currMass = [];
            for (mass of d[1].fromMasses) {
                currMass.push([d[0], d[1], mass])
            }
            return currMass;
        })
    let lfromEnter = lfrom.enter()
        .append('circle')
            .attr('class', 'frommass');
    lfrom.exit().remove();
    lfrom.merge(lfromEnter)
        .attr('r', (d) => getSize(d[2], false))
        .attr('fill', (d) => d[2].mass > 0 ? "green" : "red")
        .attr('transform', (d,i,g) => {
            // lmao; hella sketch :p
            path = g[i].parentElement.getElementsByTagName('path')[0]
            return getProgAlong(path, 100 - d[2].prog);
        })

    ntxt = d3.select('#names')
        .selectAll('text')
        .data(nodes);
    ntxtEnter = ntxt.enter()
        .append('text');
    ntxt.exit().remove();
    ntxt.merge(ntxtEnter)
        .attr('transform', (d) => {
            let posX = positions[0].get(d.id) + 10,
                posY = positions[1].get(d.id) - 10;
            return 'translate(' + posX + ',' + posY + ')';
        })
        .text((d) => {
            let ind;
            if (Math.abs(d.pop - d.cap/2) < 3) {
                ind = "";
            } else if (d.pop > d.cap/2) {
                ind = "(↑)";
            } else {
                ind = "(↓)";
            }
            return d.name + ind;
        })
        .attr('class', 'node_name');

}

function getParameterByName(name) {
    name = name.replace(/[\[]/, "\\\[").replace(/[\]]/, "\\\]");
    var regexS = "[\\?&]" + name + "=([^&#]*)";
    var regex = new RegExp(regexS);
    var results = regex.exec(window.location.href);
    if (results == null)
        return "";
    else
        return decodeURIComponent(results[1].replace(/\+/g, " "));
}

function init() {
    let MODE = getParameterByName("mode");
    let graphobj = 'data/' + MODE + '.json';
    d3.json(graphobj, function (err, graph) {
        if (err) throw err;
        g = generateGraphFromObj(graph);
        g.setup();
        let positions = layout(g);
        render(g, positions);
    });
}

d3.select('#reset-btn').on('click', () => {
    if (playing) {
        clearInterval(playing);
        playing = false;
        d3.select('#play-btn').text("play");
    }
    let svgNode = d3.select('#diag').node();
    for (let child of svgNode.children) {
        if (child.id != "filter_defs") {
            svgNode.removeChild(child);
        }
    }
    init();
})

window.onload = function() {
    init();
}