// Contact form handling
document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    // Simulate form submission
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    // Here you would normally send data to your backend
    console.log('Form submission:', data);
    
    // Show success message
    const successMessage = document.getElementById('successMessage');
    successMessage.style.display = 'block';
    
    // Reset form
    this.reset();
    
    // Hide success message after 5 seconds
    setTimeout(() => {
        successMessage.style.display = 'none';
    }, 5000);
});

// Quick contact form handling
document.getElementById('quickContactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = new FormData(this);
    const data = Object.fromEntries(formData);
    
    console.log('Quick inquiry:', data);
    
    // Close modal and show success
    closeModal('contactModal');
    alert('Thank you! Your inquiry has been sent. We\'ll contact you soon.');
    
    this.reset();
});

// Modal functions
function openContactModal(product) {
    document.getElementById('modalProduct').value = product;
    document.getElementById('modalMessage').placeholder = `I'm interested in your ${product}. Please provide more information.`;
    document.getElementById('contactModal').style.display = 'block';
}

function openVideoModal(videoType) {
    const modal = document.getElementById('videoModal');
    const title = document.getElementById('videoTitle');
    const content = document.getElementById('videoContent');
    
    if (videoType === 'rams-video') {
        title.textContent = 'Ram Videos';
        content.innerHTML = `
            <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 10px;">
                <h3>🐑 Premium Ram Collection</h3>
                <p>Upload your ram videos here. You can showcase:</p>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <li>Individual ram profiles</li>
                    <li>Breeding demonstrations</li>
                    <li>Feeding and care routines</li>
                    <li>Farm facility tours</li>
                </ul>
                <p style="margin-top: 1rem;"><em>Videos will be embedded here once uploaded</em></p>
            </div>
        `;
    } else if (videoType === 'beans-video') {
        title.textContent = 'Bean Farm Videos';
        content.innerHTML = `
            <div style="text-align: center; padding: 2rem; background: #f8f9fa; border-radius: 10px;">
                <h3>🌱 Bean Farming Process</h3>
                <p>Upload your bean farming videos here. You can showcase:</p>
                <ul style="text-align: left; max-width: 400px; margin: 0 auto;">
                    <li>Planting and cultivation</li>
                    <li>Growing process timeline</li>
                    <li>Harvesting techniques</li>
                    <li>Quality control measures</li>
                </ul>
                <p style="margin-top: 1rem;"><em>Videos will be embedded here once uploaded</em></p>
            </div>
        `;
    }
    
    modal.style.display = 'block';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// Close modal when clicking outside
window.addEventListener('click', function(event) {
    const contactModal = document.getElementById('contactModal');
    const videoModal = document.getElementById('videoModal');
    
    if (event.target === contactModal) {
        contactModal.style.display = 'none';
    }
    if (event.target === videoModal) {
        videoModal.style.display = 'none';
    }
});

// Smooth scrolling for navigation links
document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
        e.preventDefault();
        const target = document.querySelector(this.getAttribute('href'));
        if (target) {
            target.scrollIntoView({
                behavior: 'smooth',
                block: 'start'
            });
        }
    });
});

// Header scroll effect
window.addEventListener('scroll', function() {
    const header = document.querySelector('header');
    if (window.scrollY > 100) {
        header.style.background = 'rgba(255, 255, 255, 0.98)';
    } else {
        header.style.background = 'rgba(255, 255, 255, 0.95)';
    }
});
