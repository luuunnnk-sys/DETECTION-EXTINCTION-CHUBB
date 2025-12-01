function generateReport() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    // --- PARTIE VISUELLE 3D ---
    // --- PARTIE VISUELLE 3D ---
    // Force labels visible for export
    const wasLabelsVisible = labelGroup.visible;
    labelGroup.visible = true;
    renderer.render(scene, camera);
    const img = renderer.domElement.toDataURL("image/png");
    labelGroup.visible = wasLabelsVisible; // Restore state

    // --- CRÉATION DU PDF ---
    // Titre
    doc.setFontSize(22); doc.setTextColor(40); doc.text("Rapport Technique", 15, 20);
    doc.setFontSize(12); doc.setTextColor(100); doc.text("Généré le " + new Date().toLocaleDateString(), 15, 28);

    // Image 3D
    doc.addImage(img, 'PNG', 15, 35, 180, 100);

    // Légende des couleurs
    doc.setFontSize(10);
    doc.setFillColor(34, 197, 94); doc.rect(15, 140, 4, 4, 'F');
    doc.setTextColor(34, 197, 94); doc.text("Faux-Plafond", 21, 143);

    doc.setFillColor(249, 115, 22); doc.rect(60, 140, 4, 4, 'F');
    doc.setTextColor(249, 115, 22); doc.text("Ambiance", 66, 143);

    doc.setFillColor(234, 179, 8); doc.rect(105, 140, 4, 4, 'F');
    doc.setTextColor(234, 179, 8); doc.text("Faux-Plancher", 111, 143);

    // --- TABLEAU DES CARACTÉRISTIQUES ---
    let y = 155;
    doc.setFontSize(14); doc.setTextColor(0); doc.text("1. Caractéristiques", 15, y);

    doc.autoTable({
        startY: y + 5, head: [['Zone', 'Valeur']],
        body: [
            ['Dimensions', `${document.getElementById('dim-l').value}m x ${document.getElementById('dim-w').value}m`],
            ['Volume Total', document.getElementById('vol-total').innerText + " m³"],
            ['Hauteur Faux-Plancher', document.getElementById('h-fp').value + "m"],
            ['Hauteur Ambiance', document.getElementById('h-amb').value + "m"],
            ['Hauteur Faux-Plafond', document.getElementById('h-fc').value + "m"]
        ], theme: 'grid'
    });

    // --- COMPTAGE DU MATÉRIEL (Inventaire) ---
    y = doc.lastAutoTable.finalY + 15;
    doc.text("2. Inventaire Sécurité & Aménagement", 15, y);

    const vesdas = manualItems.filter(i => i.type === 'vesda').length;
    const detectors = manualItems.filter(i => i.type === 'optical').length;
    const doors = manualItems.filter(i => i.type === 'door').length;

    let tubeLen = 0;
    detectionGroup.children.forEach(c => {
        if (c.geometry && c.geometry.type === 'CylinderGeometry') tubeLen += c.geometry.parameters.height;
    });

    const extType = document.getElementById('ext-type').value;
    let extInfo = "Aucun";
    if (extType === 'ig55') extInfo = "IG55 (Gaz Inerte)";
    else if (extType === 'hifog') extInfo = "Hi-Fog (Brouillard d'Eau)";

    doc.autoTable({
        startY: y + 5, head: [['Élément', 'Quantité / Détails']],
        body: [
            ['Système Extinction', extInfo],
            ['Centrales VESDA', vesdas + " unités"],
            ['Réseau Tubulaire (Est.)', tubeLen.toFixed(1) + " mètres linéaires"],
            ['Détecteurs Optiques', detectors + " unités"],
            ['Portes', doors + " unités"]
        ], theme: 'striped'
    });

    doc.save("Rapport_Technique_3D.pdf");
}
