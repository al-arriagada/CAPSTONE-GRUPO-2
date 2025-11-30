// src/components/PetHealthReportPDF.jsx
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

// Estilos para el PDF
const styles = StyleSheet.create({
    page: {
        padding: 30,
        fontFamily: 'Helvetica',
    },
    header: {
        marginBottom: 20,
        borderBottomWidth: 2,
        borderBottomStyle: 'solid',
        borderBottomColor: '#000',
        paddingBottom: 10,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        marginBottom: 5,
    },
    subtitle: {
        fontSize: 12,
        color: '#666',
    },
    section: {
        marginTop: 15,
        marginBottom: 10,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 8,
        color: '#333',
    },
    infoRow: {
        flexDirection: 'row',
        marginBottom: 5,
    },
    label: {
        width: 150,
        fontSize: 11,
        color: '#666',
    },
    value: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    petImage: {
        width: 100,
        height: 100,
        borderRadius: 50,
        marginBottom: 10,
    },
    statsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginTop: 10,
        marginBottom: 10,
    },
    statBox: {
        width: '30%',
        padding: 10,
        backgroundColor: '#f5f5f5',
        borderRadius: 5,
    },
    statValue: {
        fontSize: 20,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    statLabel: {
        fontSize: 9,
        color: '#666',
    },
    eventItem: {
        marginBottom: 8,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomStyle: 'solid',
        borderBottomColor: '#eee',
    },
    eventType: {
        fontSize: 11,
        fontWeight: 'bold',
        marginBottom: 3,
    },
    eventDate: {
        fontSize: 9,
        color: '#666',
    },
    footer: {
        position: 'absolute',
        bottom: 30,
        left: 30,
        right: 30,
        textAlign: 'center',
        fontSize: 9,
        color: '#999',
    },
    scoreContainer: {
        alignItems: 'center',
        marginVertical: 15,
    },
    scoreCircle: {
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 4,
        borderStyle: 'solid',
        borderColor: '#FFC107',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
    },
    scoreText: {
        fontSize: 32,
        fontWeight: 'bold',
    },
    scoreLabel: {
        fontSize: 10,
        color: '#666',
    },
    chart: {
        width: '100%',
        height: 200,
        marginTop: 10,
    },
});

// Componente del PDF
const PetHealthReportPDF = ({ pet, owner, events, vaccTotals, healthScore, weightVariations, weightChartImage }) => {
    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        return new Date(dateStr).toLocaleDateString('es-CL', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
        });
    };

    const getSpeciesName = (speciesId) => {
        const species = { dog: 'Perro', cat: 'Gato', other: 'Otro' };
        return species[speciesId] || speciesId;
    };

    const calculateAge = (birthDate) => {
        if (!birthDate) return '';
        const today = new Date();
        const birth = new Date(birthDate);
        let years = today.getFullYear() - birth.getFullYear();
        let months = today.getMonth() - birth.getMonth();
        if (months < 0) {
            years--;
            months += 12;
        }
        if (years === 0) return `${months} ${months === 1 ? 'mes' : 'meses'}`;
        return `${years} ${years === 1 ? 'año' : 'años'}${months ? `, ${months}m` : ''}`;
    };

    return (
        <Document>
            <Page size="A4" style={styles.page}>
                {/* Header */}
                <View style={styles.header}>
                    <Text style={styles.title}>Reporte de Salud de Mascota</Text>
                    <Text style={styles.subtitle}>
                        Generado el {formatDate(new Date().toISOString())}
                    </Text>
                </View>

                {/* Información de la Mascota */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Información de la Mascota</Text>
                    {pet.image_url && (
                        <Image style={styles.petImage} src={pet.image_url} />
                    )}
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Nombre:</Text>
                        <Text style={styles.value}>{pet.name || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Especie:</Text>
                        <Text style={styles.value}>{getSpeciesName(pet.species_id)}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Raza:</Text>
                        <Text style={styles.value}>{pet.breed || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Edad:</Text>
                        <Text style={styles.value}>{calculateAge(pet.birth_date) || '—'}</Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Peso:</Text>
                        <Text style={styles.value}>
                            {pet.current_weight ? `${pet.current_weight} kg` : '—'}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Text style={styles.label}>Esterilizado:</Text>
                        <Text style={styles.value}>{pet.neutered ? 'Sí' : 'No'}</Text>
                    </View>
                    {pet.microchip && (
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Microchip:</Text>
                            <Text style={styles.value}>{pet.microchip}</Text>
                        </View>
                    )}
                </View>

                {/* Información del Dueño */}
                {owner && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Información del Dueño</Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Nombre:</Text>
                            <Text style={styles.value}>{owner.full_name || '—'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Email:</Text>
                            <Text style={styles.value}>{owner.email || '—'}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.label}>Teléfono:</Text>
                            <Text style={styles.value}>{owner.phone || '—'}</Text>
                        </View>
                        {owner.address_line && (
                            <View style={styles.infoRow}>
                                <Text style={styles.label}>Dirección:</Text>
                                <Text style={styles.value}>{owner.address_line}</Text>
                            </View>
                        )}
                    </View>
                )}

                {/* Puntuación de Salud */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Puntuación de Salud General</Text>
                    <View style={styles.scoreContainer}>
                        <View style={styles.scoreCircle}>
                            <Text style={styles.scoreText}>{healthScore || 50}</Text>
                        </View>
                        <Text style={styles.scoreLabel}>
                            Puntaje estimado según vacunas, peso y estado general
                        </Text>
                    </View>
                </View>

                {/* Estado de Vacunación */}
                {vaccTotals && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Estado de Vacunación</Text>
                        <View style={styles.statsContainer}>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{vaccTotals.total}</Text>
                                <Text style={styles.statLabel}>Total registradas</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{vaccTotals.upcoming}</Text>
                                <Text style={styles.statLabel}>Próximas (60 días)</Text>
                            </View>
                            <View style={styles.statBox}>
                                <Text style={styles.statValue}>{vaccTotals.overdue}</Text>
                                <Text style={styles.statLabel}>Vencidas</Text>
                            </View>
                        </View>
                    </View>
                )}

                {/* Gráfico de evolución del peso */}
                {weightChartImage && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Evolución del Peso</Text>
                        <Image style={styles.chart} src={weightChartImage} />
                    </View>
                )}

                {/* Historial Médico Reciente (primeros 5 eventos) */}
                {events && events.length > 0 && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>Historial Médico Reciente</Text>
                        {events.slice(0, 5).map((event, index) => (
                            <View key={index} style={styles.eventItem}>
                                <Text style={styles.eventType}>
                                    {event.event_type_catalog?.display_name || 'Evento'}
                                </Text>
                                <Text style={styles.eventDate}>{formatDate(event.ts)}</Text>
                                {event.var_weight && (
                                    <Text style={{ fontSize: 9, marginTop: 2 }}>
                                        Peso: {event.var_weight.value} kg
                                    </Text>
                                )}
                            </View>
                        ))}
                    </View>
                )}

                {/* Footer */}
                <View style={styles.footer}>
                    <Text>Este reporte fue generado automáticamente por PetCare Pro</Text>
                    <Text>Fecha de generación: {formatDate(new Date().toISOString())}</Text>
                </View>
            </Page>
        </Document>
    );
};

export default PetHealthReportPDF;