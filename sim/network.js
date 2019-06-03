let root = d3.select("svg");

let x = 100,
    y = 100,
    r = 20;
root.append('circle')
    .attr('cx', x)
    .attr('cy', y)
    .attr('r', r)


// GRAPH TESTING
const layout = (graph) => {
    let graph_text = d3.select('#graph-text');
    graph_text
        .append('div')
            .attr('id', 'nodes');
    graph_text
        .append('div')
            .attr('id', 'links');
    d3.select("#tick-btn").on('click', () => {
        graph.tick();
        render(graph);
    });
    d3.select("#perturb-btn").on('click', () => {
        graph.perturb(0, undefined, setExtinct=true, ignoreExtinct=true);
        render(graph);
    });
    d3.select('#extinct-btn').on('click', () => {
        graph.eradicate(0);
        render(graph);
    })
}

const render = (graph) => {
    let nodes = Array.from(graph.nodes.values());
    let nSelect = d3.select('#nodes')
        .selectAll('p')
        .data(nodes)
    let nEnter = nSelect
        .enter()
        .append('p')
    nSelect.merge(nEnter)
        .text((d,i) => {
            return d;
        });

    let links = graph.links;
    let lSelect = d3.select('#links')
        .selectAll('p')
        .data(links)
    let lEnter = lSelect
        .enter()
        .insert('p')
    lSelect.merge(lEnter)
        .text((d,i) => {
            return d;
        })
}

d3.json('data/test.json', function(err, graph) {
    if (err) throw err;
    console.log(layout);
    console.log(render);
    g = generateGraphFromObj(graph);
    g.setup();
    layout(g);
    render(g);
});