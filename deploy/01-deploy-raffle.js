const { network, ethers } = require("hardhat")
const {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
} = require("../helper-hardhat-config")
const { verify } = require("../utils/verify")

const VRF_SUB_FUND_AMOUNT = ethers.parseEther("1") // 1 Ether, or 1e18 (10^18) Wei

let vrfCoordinatorV2Mock

module.exports = async ({ getNamedAccounts, deployments }) => {
    const { deploy, log } = deployments
    const { deployer } = await getNamedAccounts()
    const chainId = network.config.chainId
    let vrfCoordinatorV2Address, subscriptionId

    if (chainId == 31337) {
        // create VRFV2 Subscription
        const contractAddress = (await deployments.get("VRFCoordinatorV2Mock")).address
        vrfCoordinatorV2Mock = await ethers.getContractAt("VRFCoordinatorV2Mock", contractAddress)
        vrfCoordinatorV2Address = vrfCoordinatorV2Mock.target

        // create the subscription
        const transactionResponse = await vrfCoordinatorV2Mock.createSubscription()
        const transactionReceipt = await transactionResponse.wait(1)
        subscriptionId = transactionReceipt.logs[0].args.subId

        // Fund the contract with LINK
        await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, VRF_SUB_FUND_AMOUNT)
    } else {
        vrfCoordinatorV2Address = networkConfig[chainId]["vrfCoordinatorV2"]
        subscriptionId = networkConfig[chainId]["subscriptionId"]
    }

    let entranceFee = networkConfig[chainId]["entranceFee"]
    let gasLane = networkConfig[chainId]["gasLane"]
    let callbackGasLimit = networkConfig[chainId]["callbackGasLimit"]
    let Interval = networkConfig[chainId]["Interval"]
    const args = [
        vrfCoordinatorV2Address,
        subscriptionId,
        entranceFee,
        gasLane,
        callbackGasLimit,
        Interval,
    ]

    // console.log(args)

    const raffle = await deploy("Raffle", {
        from: deployer,
        args: args,
        log: true,
        waitConfirmations: network.config.blockConfirmations || 3,
    })
    if (developmentChains.includes(network.name)) {
        await vrfCoordinatorV2Mock.addConsumer(Number(subscriptionId), raffle.address)

        log("Consumer is added")
    }
    if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
        log("Verifying...")
        await verify(raffle.address, args)
    }
    log("Enter lottery with command:")
    const networkName = network.name == "hardhat" ? "localhost" : network.name
    log(`yarn hardhat run scripts/enterRaffle.js --network ${networkName}`)
    log("----------------------------------------------------")
}

module.exports.tags = ["all", "raffle"]
