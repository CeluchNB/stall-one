db = connect('') // PROD ENDPOINT GOES HERE

async function run() {
    const games = db.games.find().toArray()

    const gameResult = await db.games.updateMany({}, { $set: { teamOneStatus: 'complete', teamTwoStatus: 'guest' } })
    console.log('game result', gameResult.modifiedCount)
    for (const game of games) {
        const points = db.points.find({ _id: { $in: game.points } }).toArray()
        const pointResult = await db.points.updateMany(
            { _id: { $in: game.points } },
            { $set: { gameId: game._id, teamOneStatus: 'complete', teamTwoStatus: 'guest' } },
        )
        console.log('point result', pointResult.modifiedCount)
        for (const point of points) {
            const actionList = [...point.teamOneActions, ...point.teamTwoActions]
            const actionResult = await db.actions.updateMany(
                { _id: { $in: actionList } },
                { $set: { pointId: point._id } },
            )
            console.log('action result', actionResult.modifiedCount)
        }
    }
}

run().catch(console.log)
