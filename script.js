const GOOGLE_SHEETS_API_URL = 'https://script.google.com/macros/s/AKfycbxAtsB9kK_7puRy4JfoinJXTyea6I3blA_4j4uIH4zNKnHRrnOgXsKtKVinahoGFxwx/exec';

let allGameData = [];
let filteredGameData = [];
let allPlayers = new Set(); // Todos os jogadores únicos encontrados nos dados

// Elementos do DOM
const gameFilter = document.getElementById('game-filter');
const playerFilter = document.getElementById('player-filter');
const startDateFilter = document.getElementById('start-date-filter');
const endDateFilter = document.getElementById('end-date-filter');
const applyFiltersBtn = document.getElementById('apply-filters');
const clearFiltersBtn = document.getElementById('clear-filters');

const gamesTable = document.getElementById('games-table');
const gamesTableHead = gamesTable.querySelector('thead');
const gamesTableBody = gamesTable.querySelector('tbody');

const winRateTableBody = document.querySelector('#win-rate-table tbody');
const avgScoreTableBody = document.querySelector('#avg-score-table tbody');
const totalScoreTableBody = document.querySelector('#total-score-table tbody');

let winRateChart, avgScoreChart;

// Função para buscar dados da Google Sheet API
async function fetchGameData() {
    try {
        const response = await fetch(GOOGLE_SHEETS_API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        allGameData = data.map(row => ({
            Jogo: row.Jogo === 'MM' ? 'Mexe-Mexe' : row.Jogo, // Normaliza 'MM' para 'Mexe-Mexe'
            Data: new Date(row.Data), // Converter para objeto Date
            Jogador: row.Jogador,
            Pontuacao: parseInt(row.Pontuacao), // Garantir que é número
            Vitoria: row.Vitoria, // Já deve vir como booleano
            MatchId: row.MatchId // NOVO: Usar o MatchId da API
        }));

        // Popular o filtro de jogadores e coletar todos os jogadores únicos
        allGameData.forEach(game => allPlayers.add(game.Jogador));
        playerFilter.innerHTML = '<option value="all">Todos</option>'; // Limpar antes de popular
        Array.from(allPlayers).sort().forEach(player => { // Ordenar jogadores
            const option = document.createElement('option');
            option.value = player;
            option.textContent = player;
            playerFilter.appendChild(option);
        });

        applyFilters(); // Aplicar filtros iniciais e renderizar
    } catch (error) {
        console.error('Erro ao buscar dados:', error);
        alert('Não foi possível carregar os dados. Verifique a URL da API e sua conexão.');
    }
}

// Função para aplicar filtros
function applyFilters() {
    const selectedGame = gameFilter.value;
    const selectedPlayer = playerFilter.value;
    const startDate = startDateFilter.value ? new Date(startDateFilter.value + 'T00:00:00') : null;
    const endDate = endDateFilter.value ? new Date(endDateFilter.value + 'T23:59:59') : null;

    filteredGameData = allGameData.filter(game => {
        const matchesGame = selectedGame === 'all' || game.Jogo === selectedGame;
        const matchesPlayer = selectedPlayer === 'all' || game.Jogador === selectedPlayer;

        let matchesDate = true;
        if (startDate && game.Data < startDate) {
            matchesDate = false;
        }
        if (endDate && game.Data > endDate) {
            matchesDate = false;
        }
        
        return matchesGame && matchesPlayer && matchesDate;
    });

    renderTables();
    renderCharts();
}

// Função para limpar todos os filtros
function clearFilters() {
    gameFilter.value = 'all';
    playerFilter.value = 'all';
    startDateFilter.value = '';
    endDateFilter.value = '';
    applyFilters(); // Reaplicar filtros para mostrar todos os dados
}

// Função para renderizar a tabela de jogos brutos
function renderGamesTable() {
    gamesTableHead.innerHTML = '';
    gamesTableBody.innerHTML = '';

    // Criar cabeçalho dinamicamente
    const headerRow = gamesTableHead.insertRow();
    headerRow.insertCell().textContent = 'Data';
    headerRow.insertCell().textContent = 'Jogo';
    headerRow.insertCell().textContent = 'Partida Nº';

    const sortedPlayers = Array.from(allPlayers).sort(); // Usar allPlayers para o cabeçalho
    sortedPlayers.forEach(player => {
        headerRow.insertCell().textContent = player;
    });

    // Agrupar dados por partida (MatchId) - REMOVIDO O AGRUPAMENTO, AGORA CADA LINHA É UMA PARTIDA
    // Vamos coletar todas as partidas únicas com base no MatchId
    const uniqueMatches = {};
    filteredGameData.forEach(game => {
        if (!uniqueMatches[game.MatchId]) {
            uniqueMatches[game.MatchId] = { 
                Data: game.Data,
                Jogo: game.Jogo,
                MatchId: game.MatchId,
                scores: {} // Para armazenar as pontuações dos jogadores nesta partida
            };
        }
        uniqueMatches[game.MatchId].scores[game.Jogador] = game.Pontuacao;
    });

    // Converter objeto agrupado em array e ordenar por MatchId
    console.log('uniqueMatches before sorting:', uniqueMatches);
    const sortedMatches = Object.values(uniqueMatches).sort((a, b) => b.MatchId - a.MatchId); // Sort by MatchId descending (most recent first)
    console.log('sortedMatches after sorting:', sortedMatches);

    sortedMatches.forEach((match) => {
        const row = gamesTableBody.insertRow();
        row.insertCell().textContent = match.Data.toLocaleDateString('pt-BR');
        row.insertCell().textContent = match.Jogo;
        row.insertCell().textContent = match.MatchId; // Usar MatchId como número da partida

        sortedPlayers.forEach(player => {
            const cell = row.insertCell();
            const score = match.scores[player];
            cell.textContent = score !== undefined ? score : '-';

            // Check if this player won this specific match
            const playerGame = filteredGameData.find(g => g.MatchId === match.MatchId && g.Jogador === player);
            if (playerGame && playerGame.Vitoria) {
                cell.classList.add('win-highlight');
            }
        });
    });
}

// Função para calcular e renderizar a classificação por aproveitamento
function renderWinRateTable() {
    const playerStats = {};

    filteredGameData.forEach(game => {
        if (!playerStats[game.Jogador]) {
            playerStats[game.Jogador] = { played: 0, wins: 0 };
        }
        playerStats[game.Jogador].played++;
        if (game.Vitoria) {
            playerStats[game.Jogador].wins++;
        }
    });

    const winRateData = Object.keys(playerStats).map(player => ({
        player: player,
        played: playerStats[player].played,
        wins: playerStats[player].wins,
        winRate: playerStats[player].played > 0 ? (playerStats[player].wins / playerStats[player].played) * 100 : 0
    }));

    // Classificar por aproveitamento (maior para menor)
    winRateData.sort((a, b) => b.winRate - a.winRate);

    winRateTableBody.innerHTML = '';
    winRateData.forEach((data, index) => {
        const row = winRateTableBody.insertRow();
        const rankCell = row.insertCell();
        const playerCell = row.insertCell();

        rankCell.textContent = index + 1; // Ranking
        playerCell.textContent = data.player;

        if (index === 0) {
            row.classList.add('rank-1');
            playerCell.innerHTML = '<span class="trophy-icon">🏆</span> ' + data.player;
        } else if (index === 1) {
            row.classList.add('rank-2');
        } else if (index === 2) {
            row.classList.add('rank-3');
        }

        row.insertCell().textContent = data.played;
        row.insertCell().textContent = data.wins;
        row.insertCell().textContent = data.winRate.toFixed(2) + '%';
    });
}

// Função para calcular e renderizar a classificação por média de pontuação
function renderAvgScoreTable() {
    const playerScores = {};

    filteredGameData.forEach(game => {
        if (!playerScores[game.Jogador]) {
            playerScores[game.Jogador] = { totalScore: 0, games: 0 };
        }
        playerScores[game.Jogador].totalScore += game.Pontuacao;
        playerScores[game.Jogador].games++;
    });

    const avgScoreData = Object.keys(playerScores).map(player => ({
        player: player,
        avgScore: playerScores[player].games > 0 ? playerScores[player].totalScore / playerScores[player].games : 0
    }));

    // Classificar por média de pontuação (menor para maior, pois menos pontos é melhor)
    avgScoreData.sort((a, b) => a.avgScore - b.avgScore);

    avgScoreTableBody.innerHTML = '';
    avgScoreData.forEach((data, index) => {
        const row = avgScoreTableBody.insertRow();
        const rankCell = row.insertCell();
        const playerCell = row.insertCell();

        rankCell.textContent = index + 1; // Ranking
        playerCell.textContent = data.player;

        if (index === 0) {
            row.classList.add('rank-1');
            playerCell.innerHTML = '<span class="trophy-icon">🏆</span> ' + data.player;
        } else if (index === 1) {
            row.classList.add('rank-2');
        } else if (index === 2) {
            row.classList.add('rank-3');
        }

        row.insertCell().textContent = data.avgScore.toFixed(2);
    });
}

// Função para calcular e renderizar o ranking de pontos total
function renderTotalScoreTable() {
    const playerTotalScores = {};

    filteredGameData.forEach(game => {
        if (!playerTotalScores[game.Jogador]) {
            playerTotalScores[game.Jogador] = 0;
        }
        playerTotalScores[game.Jogador] += game.Pontuacao;
    });

    const totalScoreData = Object.keys(playerTotalScores).map(player => ({
        player: player,
        totalScore: playerTotalScores[player]
    }));

    // Classificar por pontuação total (menor para maior, pois menos pontos é melhor)
    totalScoreData.sort((a, b) => a.totalScore - b.totalScore);

    totalScoreTableBody.innerHTML = '';
    totalScoreData.forEach((data, index) => {
        const row = totalScoreTableBody.insertRow();
        const rankCell = row.insertCell();
        const playerCell = row.insertCell();

        rankCell.textContent = index + 1; // Ranking
        playerCell.textContent = data.player;

        if (index === 0) {
            row.classList.add('rank-1');
            playerCell.innerHTML = '<span class="trophy-icon">🏆</span> ' + data.player;
        } else if (index === 1) {
            row.classList.add('rank-2');
        } else if (index === 2) {
            row.classList.add('rank-3');
        }

        row.insertCell().textContent = data.totalScore;
    });
}

function renderTables() {
    renderGamesTable();
    renderWinRateTable();
    renderAvgScoreTable();
    renderTotalScoreTable();
}

// Função para renderizar gráficos
function renderCharts() {
    // Dados para o gráfico de aproveitamento
    const winRateChartData = {};
    filteredGameData.forEach(game => {
        if (!winRateChartData[game.Jogador]) {
            winRateChartData[game.Jogador] = { played: 0, wins: 0 };
        }
        winRateChartData[game.Jogador].played++;
        if (game.Vitoria) {
            winRateChartData[game.Jogador].wins++;
        }
    });

    const winRateChartArray = Object.keys(winRateChartData).map(player => ({
        player: player,
        winRate: winRateChartData[player].played > 0 ? (winRateChartData[player].wins / winRateChartData[player].played) * 100 : 0
    }));
    winRateChartArray.sort((a, b) => a.winRate - b.winRate); // Crescente

    const winRateLabels = winRateChartArray.map(d => d.player);
    const winRateValues = winRateChartArray.map(d => d.winRate);

    // Dados para o gráfico de média de pontuação
    const avgScoreChartData = {};
    filteredGameData.forEach(game => {
        if (!avgScoreChartData[game.Jogador]) {
            avgScoreChartData[game.Jogador] = { totalScore: 0, games: 0 };
        }
        avgScoreChartData[game.Jogador].totalScore += game.Pontuacao;
        avgScoreChartData[game.Jogador].games++;
    });

    const avgScoreChartArray = Object.keys(avgScoreChartData).map(player => ({
        player: player,
        avgScore: avgScoreChartData[player].games > 0 ? avgScoreChartData[player].totalScore / avgScoreChartData[player].games : 0
    }));
    avgScoreChartArray.sort((a, b) => a.avgScore - b.avgScore); // Crescente (menos pontos é melhor)

    const avgScoreLabels = avgScoreChartArray.map(d => d.player);
    const avgScoreValues = avgScoreChartArray.map(d => d.avgScore);

    // Configuração comum para os gráficos
    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#e0e0e0' }
            },
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(255, 255, 255, 0.1)' },
                ticks: { color: '#e0e0e0' }
            }
        },
        plugins: {
            legend: { display: false },
            tooltip: {
                backgroundColor: 'rgba(0,0,0,0.8)',
                titleColor: '#ffcc00',
                bodyColor: '#e0e0e0',
                borderColor: '#ffcc00',
                borderWidth: 1
            }
        }
    };

    // Gráfico de Aproveitamento
    if (winRateChart) winRateChart.destroy();
    winRateChart = new Chart(document.getElementById('win-rate-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: winRateLabels,
            datasets: [{
                label: 'Aproveitamento (%)',
                data: winRateValues,
                backgroundColor: 'rgba(210, 4, 45, 0.7)', // Vermelho baralho
                borderColor: 'rgba(210, 4, 45, 1)',
                borderWidth: 1
            }]
        },
        options: chartOptions
    });

    // Gráfico de Média de Pontuação
    if (avgScoreChart) avgScoreChart.destroy();
    avgScoreChart = new Chart(document.getElementById('avg-score-chart').getContext('2d'), {
        type: 'bar',
        data: {
            labels: avgScoreLabels,
            datasets: [{
                label: 'Média de Pontuação',
                data: avgScoreValues,
                backgroundColor: 'rgba(30, 30, 30, 0.8)', // Preto baralho
                borderColor: 'rgba(30, 30, 30, 1)',
                borderWidth: 1
            }]
        },
        options: chartOptions
    });
}

// Event Listeners
applyFiltersBtn.addEventListener('click', applyFilters);
clearFiltersBtn.addEventListener('click', clearFilters);

// Inicializar o dashboard
fetchGameData();
