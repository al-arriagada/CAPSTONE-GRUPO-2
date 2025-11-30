// src/utils/chartGenerator.js
/**
 * Genera un gráfico de línea de evolución del peso usando Chart.js
 * y lo convierte a imagen base64 para usar en PDFs
 */

export const generateWeightChartImage = async (weightVariations) => {
    if (!weightVariations || weightVariations.length === 0) {
        return null;
    }

    // Crear canvas temporal
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 300;
    const ctx = canvas.getContext('2d');

    // Fondo blanco para el canvas (importante para PDFs)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Importar Chart.js dinámicamente (solo en el cliente)
    const { Chart, registerables } = await import('chart.js');
    Chart.register(...registerables);

    // Preparar datos
    const labels = weightVariations.map(w => {
        const date = new Date(w.date);
        return date.toLocaleDateString('es-CL', { day: 'numeric', month: 'short' });
    });
    const data = weightVariations.map(w => w.value);

    // Configurar gráfico
    const chart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Peso (kg)',
                data: data,
                borderColor: '#000000',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 2,
                fill: true,
                tension: 0.3,
                pointRadius: 4,
                pointBackgroundColor: '#000000',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
            }]
        },
        options: {
            responsive: false,
            animation: false, // Desactivar animaciones para renderizado inmediato
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12,
                            family: 'Arial'
                        }
                    }
                },
                title: {
                    display: true,
                    text: 'Evolución del Peso (Últimos 6 meses)',
                    font: {
                        size: 16,
                        weight: 'bold',
                        family: 'Arial'
                    },
                    padding: {
                        bottom: 20
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    title: {
                        display: true,
                        text: 'Peso (kg)',
                        font: {
                            size: 12
                        }
                    },
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Fecha',
                        font: {
                            size: 12
                        }
                    },
                    ticks: {
                        font: {
                            size: 10
                        },
                        maxRotation: 45,
                        minRotation: 45
                    }
                }
            }
        }
    });

    // Delay más largo para asegurar que el gráfico se renderice completamente
    await new Promise(resolve => setTimeout(resolve, 500));

    // Convertir a base64
    const base64Image = canvas.toDataURL('image/png');

    // Limpiar
    chart.destroy();
    canvas.remove();

    return base64Image;
};
