function generationAmount(gen) {
    switch (gen) {
        case '1':
            return 151;
        case '2':
            return 251;
        case '3':
            return 386;
        case '4':
            return 493;
        case '5':
            return 649;
        case '6':
            return 721;
        case '7':
            return 809;
        case '8':
            return 905;
        case '9':
            return 1025;
        default:
            console.log(`Gen: ${gen} not found, returning gen9 (1025)`);
            return 1025;
    }
}

module.exports = generationAmount;