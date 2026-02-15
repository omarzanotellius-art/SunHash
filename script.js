// Generate random binary characters in the background
function createBinaryBackground() {
    const container = document.getElementById('binaryBg');
    const colors = ['#06b6d4', '#a855f7', '#ec4899'];
    
    // Create 200 binary characters
    for (let i = 0; i < 200; i++) {
        const char = document.createElement('div');
        char.className = 'binary-char';
        char.textContent = Math.random() > 0.5 ? '1' : '0';
        char.style.left = `${Math.random() * 100}%`;
        char.style.top = `${Math.random() * 100}%`;
        char.style.color = colors[i % 3];
        
        container.appendChild(char);
        
        // Update character randomly
        setInterval(() => {
            char.textContent = Math.random() > 0.5 ? '1' : '0';
        }, 2000 + Math.random() * 3000);
    }
}

// Create network visualization with nodes and connections
function createNetworkVisualization() {
    const container = document.getElementById('network');
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('class', 'grid-svg');
    svg.style.opacity = '0.15';
    
    // Define gradients
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
    
    const gradient1 = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient1.setAttribute('id', 'lineGrad1');
    gradient1.setAttribute('x1', '0%');
    gradient1.setAttribute('y1', '0%');
    gradient1.setAttribute('x2', '100%');
    gradient1.setAttribute('y2', '0%');
    gradient1.innerHTML = `
        <stop offset="0%" stop-color="#06b6d4" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#ec4899" stop-opacity="0.4" />
    `;
    
    const gradient2 = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
    gradient2.setAttribute('id', 'lineGrad2');
    gradient2.setAttribute('x1', '0%');
    gradient2.setAttribute('y1', '0%');
    gradient2.setAttribute('x2', '100%');
    gradient2.setAttribute('y2', '0%');
    gradient2.innerHTML = `
        <stop offset="0%" stop-color="#a855f7" stop-opacity="0.4" />
        <stop offset="100%" stop-color="#06b6d4" stop-opacity="0.4" />
    `;
    
    defs.appendChild(gradient1);
    defs.appendChild(gradient2);
    svg.appendChild(defs);
    
    // Define nodes
    const nodes = [
        { x: 15, y: 20 },
        { x: 25, y: 15 },
        { x: 35, y: 25 },
        { x: 65, y: 18 },
        { x: 75, y: 22 },
        { x: 85, y: 15 },
        { x: 20, y: 80 },
        { x: 30, y: 85 },
        { x: 40, y: 78 },
        { x: 70, y: 82 },
        { x: 80, y: 85 },
        { x: 88, y: 78 }
    ];
    
    // Create connection lines
    nodes.forEach((node, i) => {
        nodes.slice(i + 1).forEach((targetNode, j) => {
            const distance = Math.sqrt(
                Math.pow(targetNode.x - node.x, 2) + 
                Math.pow(targetNode.y - node.y, 2)
            );
            
            if (distance < 30) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', `${node.x}%`);
                line.setAttribute('y1', `${node.y}%`);
                line.setAttribute('x2', `${targetNode.x}%`);
                line.setAttribute('y2', `${targetNode.y}%`);
                line.setAttribute('stroke', i % 2 === 0 ? 'url(#lineGrad1)' : 'url(#lineGrad2)');
                line.setAttribute('stroke-width', '0.5');
                svg.appendChild(line);
            }
        });
    });
    
    // Create nodes
    const colors = ['#06b6d4', '#a855f7', '#ec4899'];
    nodes.forEach((node, i) => {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', `${node.x}%`);
        circle.setAttribute('cy', `${node.y}%`);
        circle.setAttribute('r', '2');
        circle.setAttribute('fill', colors[i % 3]);
        circle.setAttribute('opacity', '0.5');
        svg.appendChild(circle);
    });
    
    container.appendChild(svg);
}

// Simple parallax effect on mouse move
function initParallax() {
    const network = document.querySelector('.network-visualization');
    const binary = document.querySelector('.binary-background');
    
    document.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;
        
        const moveX1 = (x - 0.5) * 20;
        const moveY1 = (y - 0.5) * 20;
        const moveX2 = (x - 0.5) * 40;
        const moveY2 = (y - 0.5) * 40;
        
        if (network) {
            network.style.transform = `translate(${moveX1}px, ${moveY1}px)`;
        }
        
        if (binary) {
            binary.style.transform = `translate(${moveX2}px, ${moveY2}px)`;
        }
    });
}

// Initialize everything when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    createBinaryBackground();
    createNetworkVisualization();
    initParallax();
});
